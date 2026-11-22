import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { installPrompt } from './install-prompt.ts'
import {
  createMediaQueryStore,
  DARK_MEDIA_QUERY,
  isEffectiveDark,
  moreItems,
  sheetGroups,
  toggledTheme,
  WIDE_MEDIA_QUERY,
  wrapFocus,
  type MenuAvailability,
  type MenuItemId,
} from './menu-model.ts'
import { PreferencesDialog } from './preferences-dialog.tsx'
import { PrivacyDialog } from './privacy-dialog.tsx'
import { appShareUrl, appWhatsappLink, shareApp } from './share-app.ts'
import { currentSourceCodeUrl } from './source-link.ts'
import { strings } from './strings.es.ts'
import { themeStore } from './theme.ts'
import { THEME_CHOICES } from './preferences.ts'
import './app-menu.css'

const SOURCE_CODE_URL = currentSourceCodeUrl()
const wideStore = createMediaQueryStore(WIDE_MEDIA_QUERY)
const systemDarkStore = createMediaQueryStore(DARK_MEDIA_QUERY)
const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'

function currentShareUrl(): string {
  return appShareUrl(__SITE_URL__, window.location, import.meta.env.BASE_URL)
}

type MenuProps = { onRestart?: () => void }

/**
 * Header menu (CAP-7). Below 900px, ⋮ opens a bottom sheet; from 900px, a bar with ⋯.
 * Only one variant is mounted, so widening with the sheet open unmounts the modal
 * dialog instead of hiding it (a hidden modal would leave the page inert).
 */
export function AppMenu({ onRestart }: MenuProps) {
  const wide = useSyncExternalStore(wideStore.subscribe, wideStore.getSnapshot, () => false)
  const Variant = wide ? DesktopBar : MobileMenu
  return <Variant onRestart={onRestart} />
}

/** «Compartir la app»: Web Share, else copy the link and offer WhatsApp. `onShared` runs after a native share. */
function useShareApp(onShared: () => void) {
  const [note, setNote] = useState(null as 'copied' | 'failed' | null)
  const share = () => {
    setNote(null)
    void shareApp(navigator, currentShareUrl()).then((outcome) => {
      if (outcome === 'copied') setNote('copied')
      else if (outcome === 'failed') setNote('failed')
      else if (outcome === 'shared') onShared()
    })
  }
  return { note, share, clear: () => setNote(null) }
}

function ShareNote({ note, onLink }: { note: 'copied' | 'failed'; onLink: () => void }) {
  return (
    <>
      <p className="app-menu-note" role="status">
        {note === 'copied' ? strings.menu.shareAppCopied : strings.menu.shareAppCopyFailed}
      </p>
      {note === 'copied' && (
        <a
          className="app-menu-item"
          href={appWhatsappLink(currentShareUrl())}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onLink}
        >
          {strings.menu.shareAppWhatsapp}
        </a>
      )}
    </>
  )
}

/** Below 900px: ⋮ opens a modal bottom sheet with four groups. */
function MobileMenu({ onRestart }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const toggleRef = useRef(null as HTMLButtonElement | null)
  const sheetRef = useRef(null as HTMLDialogElement | null)
  const restoreFocus = useRef(true)
  const sheetId = useId()
  const installable = useSyncExternalStore(installPrompt.subscribe, installPrompt.getSnapshot)
  const { note, share, clear } = useShareApp(() => setOpen(false))

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    if (open && !sheet.open) {
      restoreFocus.current = true
      sheet.showModal()
      ;(sheet.querySelector(FOCUSABLE) as HTMLElement | null)?.focus()
    }
    if (!open && sheet.open) sheet.close()
  }, [open])

  // Every way out (Escape, backdrop, an item) ends in the native close event.
  const onSheetClose = () => {
    setOpen(false)
    clear()
    if (restoreFocus.current) toggleRef.current?.focus()
  }

  const onSheetKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll(FOCUSABLE)] as HTMLElement[]
    const next = wrapFocus(controls.indexOf(document.activeElement as HTMLElement), controls.length, event.shiftKey)
    if (next === -1) return
    event.preventDefault()
    controls[next].focus()
  }

  // A backdrop click targets the dialog itself and lands outside its box (its own surface or
  // scrollbar also target the dialog; keyboard-activated clicks on items target the item).
  const onSheetClick = (event: ReactMouseEvent) => {
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
    if (!inside) setOpen(false)
  }

  const close = () => setOpen(false)

  const renderSheetItem = (id: MenuItemId): ReactNode => {
    switch (id) {
      case 'theme': {
        return <ThemeChoiceGroup />
      }
      case 'share': {
        return (
          <>
            <button type="button" className="app-menu-item" onClick={share}>
              <ItemContent icon="share" label={strings.menu.shareApp} />
            </button>
            {note && <ShareNote note={note} onLink={close} />}
          </>
        )
      }
      case 'install': {
        return (
          <InstallItem
            onSelect={() => {
              close()
              void installPrompt.install()
            }}
          />
        )
      }
      case 'preferences': {
        return (
          <button
            type="button"
            className="app-menu-item"
            onClick={() => {
              restoreFocus.current = false
              close()
              setPrefsOpen(true)
            }}
          >
            <ItemContent icon="prefs" label={strings.menu.preferences} />
          </button>
        )
      }
      case 'privacy': {
        return (
          <button
            type="button"
            className="app-menu-item"
            onClick={() => {
              restoreFocus.current = false
              close()
              setPrivacyOpen(true)
            }}
          >
            <ItemContent icon="info" label={strings.menu.privacy} />
          </button>
        )
      }
      case 'sourceCode':
      case 'sourceCodeUnavailable': {
        return <SourceCodeItem onSelect={close} />
      }
      case 'restart': {
        return (
          <RestartItem
            onSelect={() => {
              // The step change focuses the step title; do not pull focus back to ⋮.
              restoreFocus.current = false
              close()
              onRestart?.()
            }}
          />
        )
      }
    }
  }

  return (
    <div className="app-menu">
      <button
        ref={toggleRef}
        type="button"
        className="app-menu-toggle"
        aria-label={strings.menu.buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={sheetId}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">{strings.menu.button}</span>
      </button>
      <dialog
        ref={sheetRef}
        id={sheetId}
        className="menu-sheet"
        aria-label={strings.menu.sheetTitle}
        onClose={onSheetClose}
        onKeyDown={onSheetKeyDown}
        onClick={onSheetClick}
      >
        <div className="menu-sheet-body">
          {sheetGroups(availability(installable, onRestart)).map((group) => (
            <div key={group.join()} className="menu-sheet-group">
              {group.map((id) => (
                <Fragment key={id}>{renderSheetItem(id)}</Fragment>
              ))}
            </div>
          ))}
        </div>
      </dialog>
      <PrivacyDialog
        open={privacyOpen}
        onClose={() => {
          setPrivacyOpen(false)
          toggleRef.current?.focus()
        }}
      />
      <PreferencesDialog
        open={prefsOpen}
        onClose={() => {
          setPrefsOpen(false)
          toggleRef.current?.focus()
        }}
      />
    </div>
  )
}

/** From 900px: «Cómo funciona», «Compartir la app», the theme button and ⋯ in the header. */
function DesktopBar({ onRestart }: MenuProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const moreRef = useRef(null as HTMLDivElement | null)
  const moreToggleRef = useRef(null as HTMLButtonElement | null)
  const privacyRef = useRef(null as HTMLButtonElement | null)
  const shareRef = useRef(null as HTMLDivElement | null)
  const shareButtonRef = useRef(null as HTMLButtonElement | null)
  const listId = useId()
  const installable = useSyncExternalStore(installPrompt.subscribe, installPrompt.getSnapshot)
  const { note, share, clear } = useShareApp(() => {})
  const dismissNote = () => {
    clear()
    shareButtonRef.current?.focus()
  }

  useDismiss(moreOpen, moreRef, () => {
    setMoreOpen(false)
    moreToggleRef.current?.focus()
  }, () => setMoreOpen(false))
  useDismiss(note !== null, shareRef, dismissNote, clear)

  const closeMore = () => {
    setMoreOpen(false)
    moreToggleRef.current?.focus()
  }

  const onMoreFocusOut = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) setMoreOpen(false)
  }

  const onShareFocusOut = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) clear()
  }

  return (
    <div className="app-menu app-menu-bar">
      <button ref={privacyRef} type="button" className="app-bar-button" onClick={() => setPrivacyOpen(true)}>
        <ItemContent icon="info" label={strings.menu.bar.privacy} />
      </button>
      <div className="app-bar-share" ref={shareRef} onBlur={onShareFocusOut}>
        <button ref={shareButtonRef} type="button" className="app-bar-button" onClick={share}>
          <ItemContent icon="share" label={strings.menu.bar.shareApp} />
        </button>
        {note && (
          <div className="app-bar-popover">
            <ShareNote note={note} onLink={dismissNote} />
            <button type="button" className="app-menu-item" onClick={dismissNote}>
              {strings.menu.close}
            </button>
          </div>
        )}
      </div>
      <ThemeToggle />
      <div className="app-menu-more" ref={moreRef} onBlur={onMoreFocusOut}>
        <button
          ref={moreToggleRef}
          type="button"
          className="app-menu-toggle"
          aria-label={strings.menu.buttonLabel}
          aria-expanded={moreOpen}
          aria-controls={listId}
          onClick={() => setMoreOpen((value) => !value)}
        >
          <span aria-hidden="true">{strings.menu.desktopButton}</span>
        </button>
        <ul id={listId} className="app-menu-list" hidden={!moreOpen}>
          {moreItems(availability(installable, onRestart)).map((id) => {
            if (id === 'install') {
              return (
                <li key={id}>
                  <InstallItem
                    onSelect={() => {
                      closeMore()
                      void installPrompt.install()
                    }}
                  />
                </li>
              )
            }
            if (id === 'preferences') {
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="app-menu-item"
                    onClick={() => {
                      setMoreOpen(false)
                      setPrefsOpen(true)
                    }}
                  >
                    <ItemContent icon="prefs" label={strings.menu.preferences} />
                  </button>
                </li>
              )
            }
            if (id === 'restart') {
              return (
                <li key={id} className="app-menu-separated">
                  <RestartItem
                    onSelect={() => {
                      closeMore()
                      onRestart?.()
                    }}
                  />
                </li>
              )
            }
            return (
              <li key={id}>
                <SourceCodeItem onSelect={closeMore} />
              </li>
            )
          })}
        </ul>
      </div>
      <PrivacyDialog
        open={privacyOpen}
        onClose={() => {
          setPrivacyOpen(false)
          privacyRef.current?.focus()
        }}
      />
      <PreferencesDialog
        open={prefsOpen}
        onClose={() => {
          setPrefsOpen(false)
          moreToggleRef.current?.focus()
        }}
      />
    </div>
  )
}

/** While `active`: Escape calls `onEscape`; a pointer press outside `ref` calls `onOutside`. */
function useDismiss(
  active: boolean,
  ref: { current: HTMLElement | null },
  onEscape: () => void,
  onOutside: () => void,
) {
  const handlers = useRef({ onEscape, onOutside })
  useEffect(() => {
    handlers.current = { onEscape, onOutside }
  })
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlers.current.onEscape()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) handlers.current.onOutside()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [active, ref])
}

/** Desktop theme button: toggles Claro/Oscuro from what is on screen; pressed when dark. */
function ThemeToggle() {
  const choice = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot)
  const systemDark = useSyncExternalStore(systemDarkStore.subscribe, systemDarkStore.getSnapshot, () => false)
  return (
    <button
      type="button"
      className="app-bar-button"
      aria-pressed={isEffectiveDark(choice, systemDark)}
      onClick={() => themeStore.setChoice(toggledTheme(choice, systemDark))}
    >
      <ItemContent icon="theme" label={strings.menu.bar.theme} />
    </button>
  )
}

function availability(installable: boolean, onRestart: (() => void) | undefined): MenuAvailability {
  return { installable, canRestart: onRestart !== undefined, hasSourceCode: Boolean(SOURCE_CODE_URL) }
}

function InstallItem({ onSelect }: { onSelect: () => void }) {
  return (
    <button type="button" className="app-menu-item" onClick={onSelect}>
      <ItemContent icon="install" label={strings.menu.install} />
    </button>
  )
}

function RestartItem({ onSelect }: { onSelect: () => void }) {
  return (
    <button type="button" className="app-menu-item app-menu-danger" onClick={onSelect}>
      <ItemContent icon="restart" label={strings.menu.restart} note={strings.menu.restartNote} />
    </button>
  )
}

/** "Código fuente": a new-tab link to the served commit, or a disabled item when the build has no repo URL. */
function SourceCodeItem({ onSelect }: { onSelect: () => void }) {
  if (!SOURCE_CODE_URL) {
    return (
      <button type="button" className="app-menu-item" disabled>
        <ItemContent icon="code" label={strings.menu.sourceCode} note={strings.menu.sourceCodeUnavailable} />
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
      <ItemContent
        icon="code"
        label={
          <>
            {strings.menu.sourceCode} <span aria-hidden="true">{strings.menu.externalMark}</span>
          </>
        }
      />
    </a>
  )
}

/** «Tema»: Sistema / Claro / Oscuro as pressed buttons (CAP-6). Choosing one keeps the sheet open. */
function ThemeChoiceGroup() {
  const choice = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot)
  const labelId = useId()
  const copy = strings.menu.theme
  return (
    <div className="app-menu-theme">
      <span id={labelId} className="app-menu-theme-label">
        {copy.label}
      </span>
      <div className="app-menu-theme-options" role="group" aria-labelledby={labelId}>
        {THEME_CHOICES.map((option) => (
          <button
            key={option}
            type="button"
            className="app-menu-theme-option"
            aria-pressed={choice === option}
            onClick={() => themeStore.setChoice(option)}
          >
            {copy.options[option]}
          </button>
        ))}
      </div>
    </div>
  )
}

const ICONS = {
  theme: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  share: 'M12 15V3M7 8l5-5 5 5M5 12v8h14v-8',
  install: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-5M12 8h.01',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  prefs: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  restart: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4',
} as const

/** A decorative icon next to the visible label (and an optional note under it). */
function ItemContent({ icon, label, note }: { icon: keyof typeof ICONS; label: ReactNode; note?: string }) {
  return (
    <>
      <svg className="app-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={ICONS[icon]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="app-menu-item-text">
        <span>{label}</span>
        {note && <span className="app-menu-item-note">{note}</span>}
      </span>
    </>
  )
}
