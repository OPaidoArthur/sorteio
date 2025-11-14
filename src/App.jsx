import { useEffect, useMemo, useState } from 'react'
import './App.css'
import digitalHubLogo from './assets/digital-hub-logo.gif'

const STORAGE_KEYS = {
  participants: 'sorteio:participants',
  myName: 'sorteio:my-name',
}

const TABS = {
  user: 'user',
  admin: 'admin',
}

const ADMIN_RULES = {
  name: 'Elizomar',
  password: '@5759#*',
}

const ADMIN_NAME_NORMALIZED = ADMIN_RULES.name.toLowerCase()

const loadParticipants = () => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.participants)
    if (!stored) {
      return []
    }
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const ParticipantsSection = ({
  items,
  title,
  subtitle,
  emptyMessage,
}) => (
  <section className="participants">
    <div className="participants__header">
      <h2>
        {title} ({items.length})
      </h2>
      <p>{subtitle}</p>
    </div>

    {items.length ? (
      <ul>
        {items.map((participant) => (
          <li key={participant}>
            <span>{participant}</span>
          </li>
        ))}
      </ul>
    ) : (
      <div className="empty">{emptyMessage}</div>
    )}
  </section>
)

function App() {
  const [participants, setParticipants] = useState([])
  const [nameInput, setNameInput] = useState('')
  const [myName, setMyName] = useState('')
  const [winner, setWinner] = useState('')
  const [error, setError] = useState('')
  const [hasHydrated, setHasHydrated] = useState(false)
  const [activeTab, setActiveTab] = useState(TABS.user)
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false)
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')

  useEffect(() => {
    const storedParticipants = loadParticipants()
    setParticipants(storedParticipants)

    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem(STORAGE_KEYS.myName)
      if (storedName) {
        setMyName(storedName)
        setNameInput(storedName)
      }
    }
    setHasHydrated(true)
  }, [])

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') {
      return
    }

    localStorage.setItem(
      STORAGE_KEYS.participants,
      JSON.stringify(participants),
    )
  }, [participants, hasHydrated])

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') {
      return
    }

    const handleStorage = (event) => {
      if (event.key === STORAGE_KEYS.participants) {
        if (!event.newValue) {
          setParticipants([])
          return
        }

        try {
          const parsed = JSON.parse(event.newValue)
          if (Array.isArray(parsed)) {
            setParticipants(parsed)
          }
        } catch {
          // ignore malformed payloads
        }
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [hasHydrated])

  useEffect(() => {
    const normalized = (myName || '').trim().toLowerCase()
    if (!normalized || normalized !== ADMIN_NAME_NORMALIZED) {
      setIsAdminAuthorized(false)
    }
  }, [myName])

  useEffect(() => {
    if (!isAdminAuthorized && activeTab === TABS.admin) {
      setActiveTab(TABS.user)
    }
  }, [isAdminAuthorized, activeTab])

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [participants])

  const normalizedMyName = (myName || '').trim().toLowerCase()
  const isAdminName = normalizedMyName === ADMIN_NAME_NORMALIZED
  const isAdmin = activeTab === TABS.admin && isAdminAuthorized

  const isRegistered = useMemo(() => {
    if (!myName) {
      return false
    }

    return participants.some(
      (name) => name.toLowerCase() === myName.toLowerCase(),
    )
  }, [participants, myName])

  const handleRegistration = (event) => {
    event.preventDefault()
    const normalized = nameInput.trim()

    if (!normalized) {
      setError('Informe um nome valido.')
      return
    }

    setError('')
    setMyName(normalized)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.myName, normalized)
    }

    setParticipants((current) => {
      const exists = current.some(
        (name) => name.toLowerCase() === normalized.toLowerCase(),
      )

      if (exists) {
        return current
      }

      return [...current, normalized]
    })
  }

  const handleDraw = () => {
    if (!participants.length) {
      return
    }

    const index = Math.floor(Math.random() * participants.length)
    setWinner(participants[index])
  }

  const handleReset = () => {
    setWinner('')
  }

  const canDraw = participants.length > 1

  const closeAdminPrompt = () => {
    setShowAdminPrompt(false)
    setAdminPassword('')
    setAdminError('')
  }

  const handleAdminUnlock = (event) => {
    event.preventDefault()

    if (!isAdminName) {
      setAdminError('Apenas Elizomar pode acessar este painel.')
      return
    }

    if (adminPassword !== ADMIN_RULES.password) {
      setAdminError('Senha incorreta. Tente novamente.')
      return
    }

    setIsAdminAuthorized(true)
    setActiveTab(TABS.admin)
    setShowAdminPrompt(false)
    setAdminPassword('')
    setAdminError('')
  }

  const handleAdminTabClick = () => {
    if (isAdminAuthorized) {
      setActiveTab(TABS.admin)
      return
    }

    setAdminError('')
    setShowAdminPrompt(true)
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__brand">
          <img src={digitalHubLogo} alt="Logo animado da Digital Hub" />
          <div>
            <span>Um produto Digital Hub P&C</span>
            <strong>Digital Hub</strong>
          </div>
        </div>
        <div>
          <p className="hero__eyebrow">Aplicativo de Sorteio Online</p>
          <h1>Sala de Sorteios</h1>
        </div>
        <p>
          Cadastre-se para participar e utilize as abas abaixo para alternar entre
          a visao do participante e o painel do administrador. Toda a experiência
          é operada pela equipe Digital Hub.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.user}
          className={`tab ${activeTab === TABS.user ? 'tab--active' : ''}`}
          onClick={() => setActiveTab(TABS.user)}
        >
          Area do participante
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.admin}
          className={`tab ${activeTab === TABS.admin ? 'tab--active' : ''}`}
          onClick={handleAdminTabClick}
        >
          Painel do administrador
        </button>
      </nav>

      {isAdmin ? (
        <>
          <section className="panel admin-panel" aria-label="Painel do administrador">
            <div className="admin-panel__summary">
              <div>
                <span className="pill">Cadastrados</span>
                <strong>{participants.length}</strong>
              </div>
              <div>
                <span className="pill">Ultimo sorteado</span>
                <strong>{winner || '-'}</strong>
              </div>
            </div>

            <div className="panel__actions">
              <button
                className="primary"
                onClick={handleDraw}
                disabled={!canDraw}
              >
                Sortear participante
              </button>
              <button className="ghost" onClick={handleReset} disabled={!winner}>
                Limpar resultado
              </button>
              {!canDraw && (
                <span className="hint">
                  Sao necessarios pelo menos 2 participantes para o sorteio.
                </span>
              )}
            </div>

            <div className="panel__result">
              <p>Resultado atual</p>
              <strong>{winner || 'Nenhum sorteio realizado'}</strong>
            </div>
          </section>

          <ParticipantsSection
            items={sortedParticipants}
            title="Lista de nomes"
            subtitle="Visualize quem entrou a partir deste dispositivo."
            emptyMessage="Nenhum participante cadastrado ate agora."
          />
        </>
      ) : (
        <>
          <section className="panel user-card" aria-label="Area do participante">
            <p className="user-card__welcome">
              Ola {myName || 'participante'}, seu nome fica salvo apenas neste
              navegador e voce ja participa do sorteio assim que aparece na lista.
            </p>
            <div className="user-card__status">
              <div>
                <span className="pill">Seu status</span>
                <strong>{isRegistered ? 'Cadastrado' : 'Entrada pendente'}</strong>
              </div>
              <div>
                <span className="pill">Total de pessoas</span>
                <strong>{participants.length}</strong>
              </div>
            </div>
            <div className="panel__result panel__result--accent">
              <p>Ultimo sorteado</p>
              <strong>{winner || 'Ainda nao houve sorteio'}</strong>
            </div>
          </section>

          <ParticipantsSection
            items={sortedParticipants}
            title="Participantes conectados"
            subtitle="Essa lista contem apenas os nomes salvos em cache neste navegador."
            emptyMessage="Nenhum participante cadastrado ate agora."
          />
        </>
      )}

      {showAdminPrompt && (
        <div className="overlay">
          {isAdminName ? (
            <form className="identify admin-access" onSubmit={handleAdminUnlock}>
              <h3>Acesso restrito</h3>
              <p>Digite a senha de segurança para abrir o painel do administrador.</p>
              <label htmlFor="admin-password">Senha</label>
              <input
                id="admin-password"
                type="password"
                value={adminPassword}
                placeholder="••••••"
                onChange={(event) => setAdminPassword(event.target.value)}
              />
              {adminError && <span className="error">{adminError}</span>}
              <div className="admin-access__actions">
                <button type="button" className="ghost" onClick={closeAdminPrompt}>
                  Cancelar
                </button>
                <button type="submit" className="primary">
                  Liberar painel
                </button>
              </div>
            </form>
          ) : (
            <div className="identify admin-access" role="dialog" aria-live="assertive">
              <h3>Acesso exclusivo</h3>
              <p>Apenas Elizomar consegue abrir o painel do administrador.</p>
              <button type="button" className="primary" onClick={closeAdminPrompt}>
                Entendi
              </button>
            </div>
          )}
        </div>
      )}

      {!myName && hasHydrated && (
        <div className="overlay">
          <form className="identify" onSubmit={handleRegistration}>
            <h3>Identifique-se</h3>
            <p>Informe seu nome para entrar automaticamente na lista.</p>
            <label htmlFor="participant-name">Nome completo</label>
            <input
              id="participant-name"
              type="text"
              placeholder="Ex.: Maria Souza"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              autoComplete="name"
            />
            {error && <span className="error">{error}</span>}
            <button type="submit" className="primary">
              Entrar na lista
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default App
