import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api' });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = 'Bearer ' + t;
  return c;
});
api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && !e.config.url.includes('/auth/login')) {
    localStorage.removeItem('token');
    if (location.pathname !== '/login') location.href = '/login';
  }
  return Promise.reject(e);
});

export const errMsg = (e) => e.response?.data?.message || (e.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your connection' : e.message) || 'Something went wrong';
export const fieldErrors = (e) => Object.fromEntries((e.response?.data?.errors || []).map((x) => [x.path, x.message]));

// Small data hook: { data, loading, error, reload }. Pass url=null to skip.
export function useFetch(url, params) {
  const [state, setState] = useState({ data: null, loading: !!url, error: null });
  const key = JSON.stringify(params || {});
  const load = useCallback(() => {
    if (!url) { setState({ data: null, loading: false, error: null }); return Promise.resolve(); }
    setState((s) => ({ ...s, loading: true, error: null }));
    return api.get(url, { params }).then((r) => setState({ data: r.data, loading: false, error: null }))
      .catch((e) => setState({ data: null, loading: false, error: errMsg(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);
  useEffect(() => { load(); }, [load]);
  const pending = !!url && !state.data && !state.error;
  return { ...state, loading: state.loading || pending, reload: load };
}
export default api;
