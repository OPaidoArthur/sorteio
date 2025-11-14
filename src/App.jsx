import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEYS = {
  participants: 'sorteio:participants',
  myName: 'sorteio:my-name',
}

const TABS = {
  user: 'user',
  admin: 'admin',
}

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

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [participants])

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
  const isAdmin = activeTab === TABS.admin

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="hero__eyebrow">Aplicativo de Sorteio Online</p>
          <h1>Sala de Sorteios</h1>
        </div>
        <p>
          Cadastre-se para participar e utilize as abas abaixo para alternar entre
          a visao do participante e o painel do administrador.
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
          onClick={() => setActiveTab(TABS.admin)}
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
