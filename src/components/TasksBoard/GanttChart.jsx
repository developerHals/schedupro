import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';

const GanttChart = ({ tasks, users, onEditTask }) => {
  const chartOption = useMemo(() => {
    // 1. Prepare Data
    // Filter out tasks that might cause issues (though we handle defaults)
    // Sort by start date
    const sortedTasks = [...tasks].sort((a, b) => 
      new Date(a.created_at || new Date()) - new Date(b.created_at || new Date())
    );

    const taskNames = sortedTasks.map(t => t.description.substring(0, 20) + (t.description.length > 20 ? '...' : ''));
    
    // Calculate start times and durations
    const data = sortedTasks.map(task => {
      const startDate = task.created_at ? new Date(task.created_at) : new Date();
      
      // Determine end date:
      // 1. If completed and has completion_date, use completion_date
      // 2. If deadline exists, use deadline
      // 3. Default to start + 3 days
      let endDate;
      if (task.status === 'Completed' && task.completion_date) {
        endDate = new Date(task.completion_date);
      } else if (task.deadline) {
        endDate = new Date(task.deadline);
      } else {
        endDate = addDays(startDate, 3);
      }
      
      // Ensure end is after start
      const finalEndDate = endDate < startDate ? addDays(startDate, 1) : endDate;

      return {
        name: task.description,
        value: [
          0, // Placeholder for index, set later if needed
          startDate,
          finalEndDate,
          differenceInDays(finalEndDate, startDate)
        ],
        itemStyle: {
          color: getStatusColor(task.status)
        },
        task: task // Store full task for click handler
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        formatter: function (params) {
          const task = params.data.task;
          const start = format(params.value[1], 'MMM d, yyyy');
          const end = format(params.value[2], 'MMM d, yyyy');
          return `
            <div style="font-weight:bold">${task.description}</div>
            <div>Status: ${task.status}</div>
            <div>Start: ${start}</div>
            <div>End: ${end}</div>
            ${task.assigned_to ? `<div>Assigned: ${getAssigneeName(task.assigned_to, users)}</div>` : ''}
          `;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: (value) => format(new Date(value), 'MMM d')
        }
      },
      yAxis: {
        type: 'category',
        data: taskNames,
        axisLabel: {
          width: 150,
          overflow: 'truncate'
        }
      },
      dataZoom: [
        {
          type: 'slider',
          filterMode: 'weakFilter',
          showDataShadow: false,
          top: 400,
          labelFormatter: ''
        },
        {
          type: 'inside',
          filterMode: 'weakFilter'
        }
      ],
      series: [
        {
          type: 'custom',
          renderItem: function (params, api) {
            const categoryIndex = api.value(0);
            const start = api.coord([api.value(1), categoryIndex]);
            const end = api.coord([api.value(2), categoryIndex]);
            const height = api.size([0, 1])[1] * 0.6;
            
            const rectShape = ReactECharts.graphic.clipRectByRect(
              {
                x: start[0],
                y: start[1] - height / 2,
                width: end[0] - start[0],
                height: height
              },
              {
                x: params.coordSys.x,
                y: params.coordSys.y,
                width: params.coordSys.width,
                height: params.coordSys.height
              }
            );

            return (
              rectShape && {
                type: 'rect',
                transition: ['shape'],
                shape: rectShape,
                style: api.style()
              }
            );
          },
          itemStyle: {
            opacity: 0.8
          },
          encode: {
            x: [1, 2],
            y: 0
          },
          data: data.map((item, index) => ({
            value: [index, item.value[1], item.value[2], item.value[3]],
            itemStyle: item.itemStyle,
            task: item.task
          }))
        }
      ]
    };
  }, [tasks, users]);

  const onEvents = {
    'click': (params) => {
      if (params.data && params.data.task) {
        onEditTask(params.data.task);
      }
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm min-h-[500px]">
      <ReactECharts 
        option={chartOption} 
        style={{ height: '500px', width: '100%' }}
        onEvents={onEvents}
      />
    </div>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'To do': return '#9ca3af'; // gray
    case 'Planned': return '#3b82f6'; // blue
    case 'In course': return '#eab308'; // yellow
    case 'Completed': return '#22c55e'; // green
    case 'Closed': return '#a855f7'; // purple
    default: return '#9ca3af';
  }
};

const getAssigneeName = (userId, users) => {
  const user = users.find(u => u.id === userId);
  return user ? (user.full_name || user.email) : 'Unassigned';
};

export default GanttChart;
