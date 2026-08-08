import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { debounce } from '../lib/utils';

export default function SearchInput({ placeholder = 'Search...', onSearch, className = '' }) {
  const [value, setValue] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce((q) => onSearch(q), 300), [onSearch]);

  function handleChange(e) {
    const val = e.target.value;
    setValue(val);
    debouncedSearch(val);
  }

  function handleClear() {
    setValue('');
    onSearch('');
  }

  return (
    <div className={`relative group ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-400"
      />
      {value && (
        <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
