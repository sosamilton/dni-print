import { strings } from './strings.es.ts'
import './brand.css'

/** Marca de marcas de corte + wordmark (identity.md). La geometría es la de identity.md, sin cambios. */
export function Brand() {
  return (
    <div className="brand">
      <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <g className="brand-corners" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18V9a3 3 0 013-3h9" />
          <path d="M46 6h9a3 3 0 013 3v9" />
          <path d="M58 46v9a3 3 0 01-3 3h-9" />
          <path d="M18 58H9a3 3 0 01-3-3v-9" />
        </g>
        <rect className="brand-card" x="15" y="21" width="34" height="22" rx="3.5" />
        <circle className="brand-sun" cx="24.5" cy="32" r="4.2" />
        <rect className="brand-line" x="31" y="27.5" width="13" height="2.8" rx="1.4" />
        <rect className="brand-line" x="31" y="33.5" width="9" height="2.8" rx="1.4" opacity=".85" />
      </svg>
      <span className="brand-wordmark">
        {strings.brand.dni} <span className="brand-print">{strings.brand.print}</span>
      </span>
    </div>
  )
}
