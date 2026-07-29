// Proxy data service: routes supported tables through same-origin Pages Functions.
// Unsupported tables fall back to a full no-op chain while their endpoints are built.
const API_ROOT = '/api';

const SUPPORTED_TABLES = {
  rooms: `${API_ROOT}/rooms`,
  users: `${API_ROOT}/users`,
};

const EMPTY_RESPONSE = { data: [], error: null };
const SINGLE_RESPONSE = { data: null, error: null };

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeError(error) {
  if (error instanceof Error) return { message: error.message };
  if (typeof error === 'string') return { message: error };
  if (error && typeof error.message === 'string') return error;
  return { message: 'Unknown error' };
}

function applySelect(data, columns) {
  if (!columns || columns === '*') return data;
  const keys = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (!keys.length) return data;
  if (Array.isArray(data)) {
    return data.map((row) => {
      const out = {};
      keys.forEach((k) => {
        if (k in row) out[k] = row[k];
      });
      return out;
    });
  }
  if (data && typeof data === 'object') {
    const out = {};
    keys.forEach((k) => {
      if (k in data) out[k] = data[k];
    });
    return out;
  }
  return data;
}

function applyClientFilters(rows, state) {
  if (!Array.isArray(rows)) return rows;
  let data = rows;

  if (state.eqFilter) {
    const { column, value } = state.eqFilter;
    data = data.filter((row) => String(row[column]) === String(value));
  }
  if (state.neqFilter) {
    const { column, value } = state.neqFilter;
    data = data.filter((row) => String(row[column]) !== String(value));
  }
  if (state.gtFilter) {
    const { column, value } = state.gtFilter;
    data = data.filter((row) => {
      const a = Number(row[column]) || 0;
      const b = Number(value) || 0;
      return a > b;
    });
  }
  if (state.gteFilter) {
    const { column, value } = state.gteFilter;
    data = data.filter((row) => {
      const a = Number(row[column]) || 0;
      const b = Number(value) || 0;
      return a >= b;
    });
  }
  if (state.ltFilter) {
    const { column, value } = state.ltFilter;
    data = data.filter((row) => {
      const a = Number(row[column]) || 0;
      const b = Number(value) || 0;
      return a < b;
    });
  }
  if (state.lteFilter) {
    const { column, value } = state.lteFilter;
    data = data.filter((row) => {
      const a = Number(row[column]) || 0;
      const b = Number(value) || 0;
      return a <= b;
    });
  }
  if (state.inFilter) {
    const { column, values } = state.inFilter;
    const set = new Set((values || []).map(String));
    data = data.filter((row) => set.has(String(row[column])));
  }
  if (state.ilikeFilter) {
    const { column, pattern } = state.ilikeFilter;
    const term = pattern.replace(/^%|%$/g, '').toLowerCase();
    data = data.filter((row) => String(row[column] || '').toLowerCase().includes(term));
  }
  if (state.orderBy) {
    const { column, ascending = true } = state.orderBy;
    data = [...data].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      if (aVal == null) return ascending ? 1 : -1;
      if (bVal == null) return ascending ? -1 : 1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return ascending ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return ascending ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }
  if (state.limit != null) {
    data = data.slice(0, state.limit);
  } else if (state.rangeEnd != null) {
    data = data.slice(state.rangeStart || 0, (state.rangeEnd || 0) + 1);
  }
  return data;
}

function executeFetch(tableName, state, isSingle) {
  return new Promise(async (resolve) => {
    try {
      const url = new URL(SUPPORTED_TABLES[tableName], window.location.origin);
      if (state.eqFilter) {
        url.searchParams.set(state.eqFilter.column, state.eqFilter.value);
      }
      const res = await fetch(url.toString());
      if (!res.ok) {
        return resolve({ data: isSingle ? null : [], error: { message: res.statusText } });
      }
      const json = await res.json();
      let data = json.data || [];
      data = applyClientFilters(data, state);
      data = applySelect(data, state.selectColumns);
      if (isSingle) {
        data = data[0] || null;
      }
      return resolve({ data, error: json.error ? normalizeError(json.error) : null });
    } catch (error) {
      return resolve({ data: isSingle ? null : [], error: normalizeError(error) });
    }
  });
}

function createRealTerminal({ tableName, method, payload, state }) {
  const terminalState = {
    selectColumns: state.selectColumns,
    isSingle: false,
  };

  const terminal = {
    select: (columns) => {
      terminalState.selectColumns = columns;
      return terminal;
    },
    single: () => {
      terminalState.isSingle = true;
      return terminal;
    },
    then: async (resolve) => {
      try {
        let url, res;
        if (method === 'DELETE') {
          url = new URL(SUPPORTED_TABLES[tableName], window.location.origin);
          if (state.eqFilter) {
            url.searchParams.set(state.eqFilter.column, state.eqFilter.value);
          }
          res = await fetch(url.toString(), { method: 'DELETE' });
        } else {
          url = new URL(SUPPORTED_TABLES[tableName], window.location.origin);
          if (method === 'PATCH' && state.eqFilter) {
            url.searchParams.set(state.eqFilter.column, state.eqFilter.value);
          }
          res = await fetch(url.toString(), {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        let data = null;
        let error = null;
        if (res.ok) {
          try {
            const json = await res.json();
            data = json.data;
            error = json.error ? normalizeError(json.error) : null;
          } catch (e) {
            data = method === 'DELETE' ? { id: state.eqFilter?.value } : null;
            error = null;
          }
        } else {
          try {
            const json = await res.json();
            error = json.error ? normalizeError(json.error) : { message: res.statusText };
          } catch (e) {
            error = { message: res.statusText };
          }
        }

        if (data != null) {
          data = applySelect(data, terminalState.selectColumns);
          if (terminalState.isSingle && Array.isArray(data)) {
            data = data[0] || null;
          }
        }
        return resolve({ data, error });
      } catch (error) {
        return resolve({ data: null, error: normalizeError(error) });
      }
    },
  };

  return terminal;
}

function createNoOpTerminal({ payload }) {
  const terminalState = {
    selectColumns: null,
    isSingle: false,
  };

  const terminal = {
    select: (columns) => {
      terminalState.selectColumns = columns;
      return terminal;
    },
    single: () => {
      terminalState.isSingle = true;
      return terminal;
    },
    then: (resolve) => {
      let rows = [];
      if (payload != null) {
        const input = Array.isArray(payload) ? payload : [payload];
        rows = input.map((row) => {
          if (row && typeof row === 'object') {
            return { id: row.id || generateId(), ...row };
          }
          return { id: generateId(), value: row };
        });
      }
      let data = terminalState.selectColumns ? applySelect(rows, terminalState.selectColumns) : rows;
      if (terminalState.isSingle) {
        data = data[0] || null;
      }
      return resolve({ data, error: null });
    },
  };

  return terminal;
}

function createBaseChain(tableName, isSingle = false, isReal = false, initialState = null) {
  const state = initialState
    ? { ...initialState }
    : {
        selectColumns: null,
        eqFilter: null,
        neqFilter: null,
        gtFilter: null,
        gteFilter: null,
        ltFilter: null,
        lteFilter: null,
        inFilter: null,
        ilikeFilter: null,
        orderBy: null,
        limit: null,
        rangeStart: null,
        rangeEnd: null,
      };

  const makeTerminal = (method, payload) => {
    if (isReal && tableName && SUPPORTED_TABLES[tableName]) {
      return createRealTerminal({ tableName, method, payload, state });
    }

    const noOpPayload =
      method === 'DELETE'
        ? { id: state.eqFilter?.value }
        : method === 'PATCH' && state.eqFilter
        ? { ...payload, id: state.eqFilter.value }
        : payload;
    return createNoOpTerminal({ payload: noOpPayload });
  };

  const chain = {
    select: (columns) => {
      state.selectColumns = columns;
      return chain;
    },
    eq: (column, value) => {
      state.eqFilter = { column, value };
      return chain;
    },
    neq: (column, value) => {
      state.neqFilter = { column, value };
      return chain;
    },
    gt: (column, value) => {
      state.gtFilter = { column, value };
      return chain;
    },
    gte: (column, value) => {
      state.gteFilter = { column, value };
      return chain;
    },
    lt: (column, value) => {
      state.ltFilter = { column, value };
      return chain;
    },
    lte: (column, value) => {
      state.lteFilter = { column, value };
      return chain;
    },
    in: (column, values) => {
      state.inFilter = { column, values: Array.isArray(values) ? values : [values] };
      return chain;
    },
    like: (column, pattern) => {
      state.ilikeFilter = { column, pattern };
      return chain;
    },
    ilike: (column, pattern) => {
      state.ilikeFilter = { column, pattern };
      return chain;
    },
    or: () => chain,
    range: (start, end) => {
      state.rangeStart = start;
      state.rangeEnd = end;
      return chain;
    },
    limit: (n) => {
      state.limit = n;
      return chain;
    },
    order: (column, { ascending = true } = {}) => {
      state.orderBy = { column, ascending };
      return chain;
    },
    abortSignal: () => chain,
    single: () => createBaseChain(tableName, true, isReal, state),
    insert: (rows) => makeTerminal('POST', rows),
    update: (updates) => makeTerminal('PATCH', updates),
    delete: () => makeTerminal('DELETE', null),
    upsert: (rows) => makeTerminal('POST', rows),
    then: (resolve) => {
      if (isReal && tableName && SUPPORTED_TABLES[tableName]) {
        return executeFetch(tableName, state, isSingle).then(resolve);
      }
      const data = isSingle ? null : [];
      return resolve({ data, error: null });
    },
  };

  return chain;
}

function createChain(tableName, isSingle = false) {
  return createBaseChain(tableName, isSingle, true);
}

function emptyChain(isSingle = false) {
  return createBaseChain(null, isSingle, false);
}

const noopChannel = {
  on: () => noopChannel,
  subscribe: () => noopChannel,
};

export const dataService = {
  from: (tableName) => {
    if (SUPPORTED_TABLES[tableName]) {
      return createChain(tableName);
    }
    return emptyChain();
  },
  channel: () => noopChannel,
  removeChannel: () => {},
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
    signUp: () => Promise.resolve({ data: {}, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: () => Promise.resolve({ error: null }),
    updateUser: () => Promise.resolve({ data: {}, error: null }),
  },
  rpc: () => emptyChain(),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      download: () => Promise.resolve({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
};

export const initializeDatabase = async () => {};
export const signIn = async () => ({ data: {}, error: null });
export const signUp = async () => ({ data: {}, error: null });
export const signOut = async () => ({ error: null });
export const getUserProfile = async () => SINGLE_RESPONSE;
export const getCourses = async () => EMPTY_RESPONSE;
export const getBookings = async () => EMPTY_RESPONSE;
