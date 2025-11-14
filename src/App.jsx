import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import digitalHubLogo from './assets/digital-hub-logo.gif'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'https://sorteiobackend.onrender.com'
const SPIN_DURATION = 10000

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

const RouletteStatus = ({
  isSpinning,
  rouletteName,
  spinProgress,
  winner,
  accent = false,
}) => {
  const classes = ['panel__result']
  if (accent) {
    classes.push('panel__result--accent')
  }
  if (isSpinning) {
    classes.push('panel__result--spinning')
  }

  return (
    <div className={classes.join(' ')}>
      <p>{isSpinning ? 'Roleta em andamento (10s)' : 'Resultado atual'}</p>
      <strong>
        {isSpinning
          ? rouletteName || 'Embaralhando nomes...'
          : winner || 'Nenhum sorteio realizado'}
      </strong>
      {isSpinning && (
        <div className="roulette">
          <div className="roulette__track">
            <div
              className="roulette__indicator"
              style={{ width: `${Math.min(spinProgress * 100, 100)}%` }}
            />
          </div>
          <span>{Math.round(spinProgress * 100)}%</span>
        </div>
      )}
    </div>
  )
}

function App() {
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
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
  const [serverError, setServerError] = useState('')
  const [isSpinning, setIsSpinning] = useState(false)
  const [rouletteName, setRouletteName] = useState('')
  const [spinProgress, setSpinProgress] = useState(0)

  const pendingWinnerRef = useRef('')
  const spinIntervalRef = useRef(null)
  const spinTimeoutRef = useRef(null)
  const spinProgressRef = useRef(null)
  const spinStartRef = useRef(null)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedName = localStorage.getItem(STORAGE_KEYS.myName)
    if (storedName) {
      setMyName(storedName)
      setNameInput(storedName)
    }
  }, [])

  const clearSpinTimers = useCallback(() => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current)
      spinIntervalRef.current = null
    }
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current)
      spinTimeoutRef.current = null
    }
    if (spinProgressRef.current) {
      cancelAnimationFrame(spinProgressRef.current)
      spinProgressRef.current = null
    }
    spinStartRef.current = null
  }, [])

  const fetchServerState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/participants`)
      if (!response.ok) {
        throw new Error('Failed to fetch participants')
      }
      const data = await response.json()
      setParticipants(
        Array.isArray(data.participants) ? data.participants : [],
      )
      setWinner(data.winner || '')
      setServerError('')
    } catch (err) {
      setServerError('Falha ao sincronizar com o servidor. Tente novamente.')
    } finally {
      setIsLoading(false)
      setHasHydrated(true)
    }
  }, [])

  const finalizeSpin = useCallback(async () => {
    clearSpinTimers()
    setIsSpinning(false)
    setSpinProgress(1)
    if (pendingWinnerRef.current) {
      setWinner(pendingWinnerRef.current)
    }
    setRouletteName('')
    pendingWinnerRef.current = ''
    await fetchServerState()
  }, [clearSpinTimers, fetchServerState])

  useEffect(() => {
    return () => {
      clearSpinTimers()
    }
  }, [clearSpinTimers])

  useEffect(() => {
    fetchServerState()
    const interval = setInterval(fetchServerState, 5000)
    return () => clearInterval(interval)
  }, [fetchServerState])

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

  const handleRegistration = async (event) => {
    event.preventDefault()
    const normalized = nameInput.trim()

    if (!normalized) {
      setError('Informe um nome valido.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: normalized }),
      })

      if (!response.ok) {
        throw new Error('Failed to register participant')
      }

      const data = await response.json()
      setParticipants(
        Array.isArray(data.participants) ? data.participants : [],
      )
      setError('')
      setMyName(normalized)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.myName, normalized)
      }

      await fetchServerState()
    } catch (err) {
      setError('Nao foi possivel cadastrar agora. Tente novamente.')
    }
  }

  const handleDraw = async () => {
    if (!canDraw || isSpinning) {
      return
    }

    setServerError('')
    pendingWinnerRef.current = ''
    startRouletteAnimation()

    try {
      const response = await fetch(`${API_BASE_URL}/draw`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to draw')
      }
      const data = await response.json()
      pendingWinnerRef.current = data.winner || ''
    } catch {
      clearSpinTimers()
      setIsSpinning(false)
      setSpinProgress(0)
      setRouletteName('')
      setServerError('Nao foi possivel realizar o sorteio.')
    }
  }

  const handleReset = async () => {
    clearSpinTimers()
    setIsSpinning(false)
    setRouletteName('')
    setSpinProgress(0)
    try {
      const response = await fetch(`${API_BASE_URL}/winner/reset`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to reset winner')
      }
      const data = await response.json()
      setWinner(data.winner || '')
      await fetchServerState()
    } catch {
      setServerError('Nao foi possivel limpar o resultado.')
    }
  }

  const canDraw = participants.length > 1

  const startRouletteAnimation = useCallback(() => {
    if (!participants.length) {
      return
    }

    spinStartRef.current = Date.now()
    setIsSpinning(true)
    setSpinProgress(0)
    setRouletteName(
      participants[Math.floor(Math.random() * participants.length)],
    )

    spinIntervalRef.current = window.setInterval(() => {
      setRouletteName(
        participants[Math.floor(Math.random() * participants.length)],
      )
    }, 140)

    const step = () => {
      if (!spinStartRef.current) {
        return
      }
      const elapsed = Date.now() - spinStartRef.current
      const progress = Math.min(elapsed / SPIN_DURATION, 1)
      setSpinProgress(progress)
      if (progress < 1) {
        spinProgressRef.current = requestAnimationFrame(step)
      }
    }

    spinProgressRef.current = requestAnimationFrame(step)
    spinTimeoutRef.current = window.setTimeout(() => {
      finalizeSpin()
    }, SPIN_DURATION)
  }, [participants, finalizeSpin])

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
            <span>Responsavel pelo site</span>
            <strong>Digital Hub</strong>
          </div>
        </div>
        <div>
          <p className="hero__eyebrow">Aplicativo de Sorteio Online</p>
          <h1>Sala de Sorteios</h1>
        </div>
        <p>
          Cadastre-se para participar e utilize as abas abaixo para alternar entre
          a visao do participante e o painel do administrador. Toda a experiencia
          e operada pela equipe Digital Hub.
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

      {serverError && (
        <div className="alert alert--error" role="alert">
          <span>{serverError}</span>
          <button type="button" className="ghost ghost--small" onClick={fetchServerState}>
            Tentar novamente
          </button>
        </div>
      )}

      {isLoading ? (
        <section className="panel loading-panel" aria-live="polite">
          <p>Carregando informacoes do sorteio...</p>
        </section>
      ) : isAdmin ? (
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
                disabled={!canDraw || isSpinning}
              >
                Sortear participante
              </button>
              <button
                className="ghost"
                onClick={handleReset}
                disabled={!winner || isSpinning}
              >
                Limpar resultado
              </button>
              {!canDraw && (
                <span className="hint">
                  Sao necessarios pelo menos 2 participantes para o sorteio.
                </span>
              )}
              {isSpinning && (
                <span className="hint">A roleta finaliza em 10 segundos.</span>
              )}
            </div>

            <RouletteStatus
              isSpinning={isSpinning}
              rouletteName={rouletteName}
              spinProgress={spinProgress}
              winner={winner}
            />
          </section>

          <ParticipantsSection
            items={sortedParticipants}
            title="Lista de nomes"
            subtitle="Visualize todos os participantes armazenados no servidor."
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
            <RouletteStatus
              accent
              isSpinning={isSpinning}
              rouletteName={rouletteName}
              spinProgress={spinProgress}
              winner={winner}
            />
            <p className="hint">
              Sempre que o administrador clicar em sortear, a roleta gira por 10
              segundos antes de revelar o vencedor final.
            </p>
          </section>

          <ParticipantsSection
            items={sortedParticipants}
            title="Participantes conectados"
            subtitle="Esta lista mostra quem se cadastrou na plataforma compartilhada."
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




