import { useEffect, useId, useRef, useState, useSyncExternalStore, type FocusEvent } from 'react'
import { installPrompt } from './install-prompt.ts'
import { PrivacyDialog } from './privacy-dialog.tsx'
import { appShareUrl, appWhatsappLink, shareApp } from './share-app.ts'
import { currentSourceCodeUrl } from './source-link.ts'
import { strings } from './strings.es.ts'
import './app-menu.css'

const SOURCE_CODE_URL = currentSourceCodeUrl()

function currentShareUrl(): string {
  return appShareUrl(__SITE_URL__, window.location, import.meta.env.BASE_URL)
}

/** Header ⋮ menu as a disclosure: a toggle button plus a list of a button and a link. */
export function AppMenu({ onRestart }: { onRestart?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [shareNote, setShareNote] = useState(null as 'copied' | 'failed' | null)
  const containerRef = useRef(null as HTMLDivElement | null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const installable = useSyncExternalStore(installPrompt.subscribe, installPrompt.getSnapshot)

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      toggleRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [menuOpen])

  const openPrivacy = () => {
    setMenuOpen(false)
    setPrivacyOpen(true)
  }

  const closeMenuAndRefocus = () => {
    setMenuOpen(false)
    toggleRef.current?.focus()
  }

  const onFocusOut = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) setMenuOpen(false)
  }

  const onShareApp = () => {
    setShareNote(null)
    void shareApp(navigator, currentShareUrl()).then((outcome) => {
      if (outcome === 'copied') setShareNote('copied')
      else if (outcome === 'failed') setShareNote('failed')
      else if (outcome === 'shared') closeMenuAndRefocus()
    })
  }

  const closePrivacy = () => {
    setPrivacyOpen(false)
    toggleRef.current?.focus()
  }

  return (
    <div className="app-menu" ref={containerRef} onBlur={onFocusOut}>
      <button
        ref={toggleRef}
        type="button"
        className="app-menu-toggle"
        aria-label={strings.menu.buttonLabel}
        aria-expanded={menuOpen}
        aria-controls={listId}
        onClick={() => {
          setShareNote(null)
          setMenuOpen((open) => !open)
        }}
      >
        <span aria-hidden="true">{strings.menu.button}</span>
      </button>
      <ul id={listId} className="app-menu-list" hidden={!menuOpen}>
        <li>
          <button type="button" className="app-menu-item" onClick={openPrivacy}>
            {strings.menu.privacy}
          </button>
        </li>
        <li>
          <button type="button" className="app-menu-item" onClick={onShareApp}>
            {strings.menu.shareApp}
          </button>
          {shareNote && (
            <p className="app-menu-note" role="status">
              {shareNote === 'copied' ? strings.menu.shareAppCopied : strings.menu.shareAppCopyFailed}
            </p>
          )}
          {shareNote === 'copied' && (
            <a
              className="app-menu-item"
              href={appWhatsappLink(currentShareUrl())}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenuAndRefocus}
            >
              {strings.menu.shareAppWhatsapp}
            </a>
          )}
        </li>
        {installable && (
          <li>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                closeMenuAndRefocus()
                void installPrompt.install()
              }}
            >
              {strings.menu.install}
            </button>
          </li>
        )}
        {onRestart && (
          <li>
            <button
              type="button"
              className="app-menu-item"
              onClick={() => {
                closeMenuAndRefocus()
                onRestart()
              }}
            >
              {strings.menu.restart}
            </button>
          </li>
        )}
        <li>
          <SourceCodeItem onSelect={closeMenuAndRefocus} />
        </li>
      </ul>
      <PrivacyDialog open={privacyOpen} onClose={closePrivacy} />
    </div>
  )
}

/** "Código fuente": a new-tab link to the served commit, or a disabled item when the build has no repo URL. */
function SourceCodeItem({ onSelect }: { onSelect: () => void }) {
  if (!SOURCE_CODE_URL) {
    return (
      <button type="button" className="app-menu-item" disabled>
        {strings.menu.sourceCode}
        <span className="app-menu-item-note">{strings.menu.sourceCodeUnavailable}</span>
      </button>
    )
  }
  return (
    <a
      className="app-menu-item"
      href={SOURCE_CODE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onSelect}
      onAuxClick={(event) => {
        if (event.button === 1) onSelect()
      }}
    >
      {strings.menu.sourceCode}
    </a>
  )
}
