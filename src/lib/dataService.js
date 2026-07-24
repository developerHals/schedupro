// Local in-memory data service stub.
// All dataService calls have been removed so the app can run without an external database.

const EMPTY_RESPONSE = { data: [], error: null };
const SINGLE_RESPONSE = { data: null, error: null };

function createChain(isSingle = false) {
  const chain = {
    abortSignal: () => chain,
    select: () => chain,
    from: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    gte: () => chain,
    lte: () => chain,
    range: () => chain,
    limit: () => chain,
    order: () => chain,
    ilike: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    upsert: () => chain,
    single: () => createChain(true),
    then: (resolve) => Promise.resolve(resolve(isSingle ? SINGLE_RESPONSE : EMPTY_RESPONSE)),
  };
  return chain;
}

const noopChannel = {
  on: () => noopChannel,
  subscribe: () => noopChannel,
};

export const dataService = {
  from: () => createChain(),
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
  rpc: () => createChain(),
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
