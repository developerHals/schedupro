import React, { useState } from 'react';
import { FiDelete } from 'react-icons/fi';

const Calculator = () => {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);

  const handleCalculate = () => {
    try {
      if (!expression) {
        setResult(null);
        return;
      }

      // Replace user-friendly operators with JS Math equivalents
      let sanitized = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/log/g, 'Math.log10')
        .replace(/ln/g, 'Math.log')
        .replace(/pi/g, 'Math.PI')
        .replace(/π/g, 'Math.PI')
        .replace(/e/g, 'Math.E');

      // Basic security check: allow only numbers, math operators, and Math functions
      // We are being slightly permissive here for the sake of functionality in a client-side tool
      // but stripping out potential dangerous characters
      sanitized = sanitized.replace(/[^0-9+\-*/().\sMathPIE_a-z]/g, '');

      // Fixed lint warning: removed unused eslint-disable
      const calcResult = new Function('return ' + sanitized)();

      if (!isFinite(calcResult) || isNaN(calcResult)) {
        throw new Error('Invalid calculation');
      }

      // Format result to avoid long decimals
      const formattedResult = Number.isInteger(calcResult) 
        ? calcResult 
        : parseFloat(calcResult.toFixed(8));

      setResult(formattedResult);
      setError(false);
    } catch (err) {
      setResult('Error');
      setError(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCalculate();
    }
  };

  const handleKeyClick = (value) => {
    if (value === 'AC') {
      setExpression('');
      setResult(null);
      setError(false);
    } else if (value === 'DEL') {
      setExpression((prev) => prev.slice(0, -1));
    } else if (value === '=') {
      handleCalculate();
    } else {
      setExpression((prev) => prev + value);
    }
  };

  const keys = [
    { label: '(', value: '(', type: 'sci' },
    { label: ')', value: ')', type: 'sci' },
    { label: 'sin', value: 'sin(', type: 'sci' },
    { label: 'cos', value: 'cos(', type: 'sci' },
    { label: 'AC', value: 'AC', type: 'action' },
    
    { label: 'tan', value: 'tan(', type: 'sci' },
    { label: 'sqrt', value: 'sqrt(', type: 'sci' },
    { label: '^', value: '^', type: 'sci' },
    { label: 'π', value: 'pi', type: 'sci' },
    { label: '÷', value: '/', type: 'op' },

    { label: '7', value: '7', type: 'num' },
    { label: '8', value: '8', type: 'num' },
    { label: '9', value: '9', type: 'num' },
    { label: 'log', value: 'log(', type: 'sci' },
    { label: '×', value: '*', type: 'op' },

    { label: '4', value: '4', type: 'num' },
    { label: '5', value: '5', type: 'num' },
    { label: '6', value: '6', type: 'num' },
    { label: 'ln', value: 'ln(', type: 'sci' },
    { label: '-', value: '-', type: 'op' },

    { label: '1', value: '1', type: 'num' },
    { label: '2', value: '2', type: 'num' },
    { label: '3', value: '3', type: 'num' },
    { label: 'e', value: 'e', type: 'sci' },
    { label: '+', value: '+', type: 'op' },

    { label: '0', value: '0', type: 'num', width: 'col-span-2' },
    { label: '.', value: '.', type: 'num' },
    { label: <FiDelete className="mx-auto" />, value: 'DEL', type: 'action' },
    { label: '=', value: '=', type: 'equal' },
  ];

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">Calculator</h3>
      </div>
      
      <div className="space-y-4">
        {/* Input Field */}
        <div>
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="(10 + 5) / 3"
            className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
            aria-label="Arithmetic expression"
          />
        </div>

        {/* Digital Display */}
        <div className="bg-gray-900 rounded-xl p-4 min-h-[60px] flex items-center justify-end overflow-x-auto shadow-inner">
          <span className={`text-2xl font-mono tracking-widest ${error ? 'text-red-400' : 'text-green-400'}`}>
            {result !== null ? result : (expression || '0')}
          </span>
        </div>
        
        {/* Scientific Keypad */}
        <div className="grid grid-cols-5 gap-2">
          {keys.map((key, index) => (
            <button
              key={index}
              onClick={() => handleKeyClick(key.value)}
              className={`
                h-10 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center justify-center
                ${key.width ? key.width : ''}
                ${key.type === 'num' ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' : ''}
                ${key.type === 'op' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
                ${key.type === 'sci' ? 'bg-gray-50 text-gray-600 hover:bg-gray-100 text-xs' : ''}
                ${key.type === 'action' ? 'bg-red-50 text-red-600 hover:bg-red-100' : ''}
                ${key.type === 'equal' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 shadow-sm' : ''}
              `}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calculator;
