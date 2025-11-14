import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import digitalHubLogo from './assets/digital-hub-logo.gif'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'https://sorteiobackend.onrender.com'
const SPIN_DURATION = 10000
const MAX_WINNERS = 5

const STORAGE_KEYS = {
  participants: 'sorteio:participants',
  myName: 'sorteio:my-name',
}

const TABS = {
  user: 'user',
  admin: 'admin',
}

const ADMIN_RULES = [
  { name: 'Elizomar', password: '@5759#*', participates: true },
  { name: 'Hub-Zero', password: '@007#*', participates: false },
]

const normalizeName = (value = '') => value.trim().toLowerCase()
const findAdminByName = (value = '') => {
  const normalized = normalizeName(value)
  return ADMIN_RULES.find((admin) => admin.name.toLowerCase() === normalized)
}

const ParticipantsSection = ({
  items,
  title,
  subtitle,
  emptyMessage,
  onRemove,
  allowRemove = false,
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
          <ParticipantRow
            key={participant}
            name={participant}
            allowRemove={allowRemove}
            onRemove={onRemove}
          />
        ))}
      </ul>
    ) : (
      <div className="empty">{emptyMessage}</div>
    )}
  </section>
)

const RACE_START = 0.04
const RACE_PRE_FINISH = 0.9

const RaceStatus = ({ isRacing, winners, raceProgress, accent = false }) => {
  const classes = ['panel__result']
  if (accent) {
    classes.push('panel__result--accent')
  }
  if (isRacing) {
    classes.push('panel__result--spinning')
  }

  const statusText = isRacing
    ? 'Corrida em andamento'
    : winners.length
      ? 'Campeões da última corrida'
      : 'Nenhum resultado ainda'

  return (
    <div className={classes.join(' ')}>
      <p>{statusText}</p>
      <strong>
        {isRacing
          ? `${Math.round(raceProgress * 100)}% concluída`
          : winners.join(', ') || 'Aguardando corrida'}
      </strong>
    </div>
  )
}

const RacingTrack = ({ racers, winners, isRacing, raceProgress }) => {
  if (!racers.length) {
    return <div className="track track--empty">Cadastre participantes</div>
  }

  const winnerLookup = winners.map((name) => name.toLowerCase())
  const hasResults = winners.length > 0

  return (
    <div className="track" role="list">
      {racers.map((name, index) => {
        const normalized = name.toLowerCase()
        const isWinner = winnerLookup.includes(normalized)

        let position = RACE_START
        if (isRacing) {
          position =
            RACE_START +
            raceProgress * (RACE_PRE_FINISH - RACE_START)
        } else if (hasResults) {
          position = isWinner ? 1 : RACE_PRE_FINISH
        }

        return (
          <div className="track__lane" key={`${name}-${index}`} role="listitem">
            <span className="track__label">{name}</span>
            <div className="track__road">
              <div className="track__finish">🏁</div>
              <div
                className={`track__car ${isWinner ? 'track__car--winner' : ''}`}
                style={{ left: `${position * 100}%` }}
              >
                <span className="track__car-icon" aria-label="carro de corrida" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const WinnersPodium = ({ winners }) => {
  const labels = ['1º lugar', '2º lugar', '3º lugar']
  return (
    <div className="podium">
      {labels.map((label, index) => (
        <div key={label} className="podium__item">
          <span>{label}</span>
          <strong>{winners[index] || 'A definir'}</strong>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [nameInput, setNameInput] = useState('')
  const [myName, setMyName] = useState('')
  const [winners, setWinners] = useState([])
  const [error, setError] = useState('')
  const [hasHydrated, setHasHydrated] = useState(false)
  const [activeTab, setActiveTab] = useState(TABS.user)
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false)
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [serverError, setServerError] = useState('')
  const [isRacing, setIsRacing] = useState(false)
  const [raceProgress, setRaceProgress] = useState(0)
  const [winnerCount, setWinnerCount] = useState(1)
  const [authorizedAdminName, setAuthorizedAdminName] = useState('')

  const pendingWinnersRef = useRef([])
  const raceTimeoutRef = useRef(null)
  const raceProgressRef = useRef(null)
  const raceStartRef = useRef(null)
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

  const clearRaceTimers = useCallback(() => {
    if (raceTimeoutRef.current) {
      clearTimeout(raceTimeoutRef.current)
      raceTimeoutRef.current = null
    }
    if (raceProgressRef.current) {
      cancelAnimationFrame(raceProgressRef.current)
      raceProgressRef.current = null
    }
    raceStartRef.current = null
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
      const serverWinners = Array.isArray(data.winners)
        ? data.winners
        : data.winner
          ? [data.winner]
          : []
      setWinners(serverWinners)
      setServerError('')
    } catch (err) {
      setServerError('Falha ao sincronizar com o servidor. Tente novamente.')
    } finally {
      setIsLoading(false)
      setHasHydrated(true)
    }
  }, [])

  const finalizeRace = useCallback(async () => {
    clearRaceTimers()
    setIsRacing(false)
    setRaceProgress(1)
    if (pendingWinnersRef.current?.length) {
      setWinners(pendingWinnersRef.current)
    }
    pendingWinnersRef.current = []
    await fetchServerState()
  }, [clearRaceTimers, fetchServerState])

  useEffect(() => {
    return () => {
      clearRaceTimers()
    }
  }, [clearRaceTimers])

  useEffect(() => {
    fetchServerState()
    const interval = setInterval(fetchServerState, 5000)
    return () => clearInterval(interval)
  }, [fetchServerState])

  useEffect(() => {
    if (!currentAdminDefinition) {
      setIsAdminAuthorized(false)
      setAuthorizedAdminName('')
      return
    }

    if (
      authorizedAdminName &&
      authorizedAdminName !== currentAdminDefinition.name
    ) {
      setIsAdminAuthorized(false)
    }
  }, [currentAdminDefinition, authorizedAdminName])

  useEffect(() => {
    if (!isAdminAuthorized && activeTab === TABS.admin) {
      setActiveTab(TABS.user)
    }
  }, [isAdminAuthorized, activeTab])

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [participants])

  const normalizedMyName = normalizeName(myName || '')
  const currentAdminDefinition = useMemo(
    () => findAdminByName(normalizedMyName),
    [normalizedMyName],
  )
  const isAdminName = Boolean(currentAdminDefinition)
  const isAdminSpectator =
    currentAdminDefinition && !currentAdminDefinition.participates
  const isAdmin =
    activeTab === TABS.admin &&
    isAdminAuthorized &&
    currentAdminDefinition &&
    authorizedAdminName === currentAdminDefinition.name
  const primaryWinner = winners[0] || ''

  const isRegistered = useMemo(() => {
    if (!myName) {
      return false
    }

    if (isAdminSpectator) {
      return true
    }

    return participants.some(
      (name) => name.toLowerCase() === myName.toLowerCase(),
    )
  }, [participants, myName, isAdminSpectator])

  const handleRegistration = async (event) => {
    event.preventDefault()
    const normalized = nameInput.trim()

    if (!normalized) {
      setError('Informe um nome valido.')
      return
    }

    const adminInfo = findAdminByName(normalized)
    if (adminInfo) {
      setError('')
      const canonicalName = adminInfo.name
      setMyName(canonicalName)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.myName, canonicalName)
      }

      if (adminInfo.participates) {
        // continue registering below
      } else {
        await fetchServerState()
        return
      }
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
      const storedName = adminInfo?.name || normalized
      setMyName(storedName)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.myName, storedName)
      }

      await fetchServerState()
    } catch (err) {
      setError('Nao foi possivel cadastrar agora. Tente novamente.')
    }
  }

  const handleDraw = async () => {
    if (isRacing) {
      return
    }

    if (winnerCount > participants.length) {
      setServerError(
        'Reduza o numero de ganhadores ou adicione mais participantes.',
      )
      return
    }

    if (!canDraw) {
      return
    }

    setServerError('')
    pendingWinnersRef.current = []
    startRaceAnimation()

    try {
      const response = await fetch(`${API_BASE_URL}/draw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: winnerCount }),
      })
      if (!response.ok) {
        throw new Error('Failed to draw')
      }
      const data = await response.json()
      const newWinners = Array.isArray(data.winners)
        ? data.winners
        : data.winner
          ? [data.winner]
          : []
      pendingWinnersRef.current = newWinners
    } catch {
      clearRaceTimers()
      setIsRacing(false)
      setRaceProgress(0)
      setServerError('Nao foi possivel realizar o sorteio.')
    }
  }

  const handleReset = async () => {
    clearRaceTimers()
    setIsRacing(false)
    setRaceProgress(0)
    pendingWinnersRef.current = []
    try {
      const response = await fetch(`${API_BASE_URL}/winner/reset`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to reset winner')
      }
      const data = await response.json()
      const serverWinners = Array.isArray(data.winners)
        ? data.winners
        : data.winner
          ? [data.winner]
          : []
      setWinners(serverWinners)
      await fetchServerState()
    } catch {
      setServerError('Nao foi possivel limpar o resultado.')
    }
  }

  const canDraw =
    participants.length >= Math.max(2, winnerCount) && winnerCount >= 1

  const startRaceAnimation = useCallback(() => {
    if (!participants.length) {
      return
    }

    raceStartRef.current = Date.now()
    setIsRacing(true)
    setRaceProgress(0)

    const step = () => {
      if (!raceStartRef.current) {
        return
      }
      const elapsed = Date.now() - raceStartRef.current
      const progress = Math.min(elapsed / SPIN_DURATION, 1)
      setRaceProgress(progress)
      if (progress < 1) {
        raceProgressRef.current = requestAnimationFrame(step)
      }
    }

    raceProgressRef.current = requestAnimationFrame(step)
    raceTimeoutRef.current = window.setTimeout(() => {
      finalizeRace()
    }, SPIN_DURATION)
  }, [participants, finalizeRace])

  const handleRemoveParticipant = async (name) => {
    if (!isAdmin) {
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/participants/${encodeURIComponent(name)}`,
        {
          method: 'DELETE',
        },
      )
      if (!response.ok) {
        throw new Error('Failed to remove participant')
      }
      const data = await response.json()
      setParticipants(
        Array.isArray(data.participants) ? data.participants : [],
      )
      const updatedWinners = Array.isArray(data.winners) ? data.winners : []
      setWinners(updatedWinners)
    } catch {
      setServerError('Nao foi possivel remover este participante.')
    }
  }

  const handleClearNonAdmins = async () => {
    if (!isAdmin || !currentAdminDefinition) {
      return
    }

    const confirmation = window.confirm(
      'Deseja remover todos os participantes exceto o administrador?',
    )
    if (!confirmation) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/participants/purge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_name: currentAdminDefinition.name }),
      })
      if (!response.ok) {
        throw new Error('Failed to purge participants')
      }
      const data = await response.json()
      setParticipants(
        Array.isArray(data.participants) ? data.participants : [],
      )
      setWinners(Array.isArray(data.winners) ? data.winners : [])
    } catch {
      setServerError('Nao foi possivel remover os participantes.')
    }
  }

  const closeAdminPrompt = () => {
    setShowAdminPrompt(false)
    setAdminPassword('')
    setAdminError('')
  }

  const handleAdminUnlock = (event) => {
    event.preventDefault()

    if (!currentAdminDefinition) {
      setAdminError('Apenas administradores podem acessar este painel.')
      return
    }

    if (adminPassword !== currentAdminDefinition.password) {
      setAdminError('Senha incorreta. Tente novamente.')
      return
    }

    setIsAdminAuthorized(true)
    setAuthorizedAdminName(currentAdminDefinition.name)
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
            <span>Equipe - </span>
            <strong>Digital Hub P&C</strong>
          </div>
        </div>
        <div>
          <p className="hero__eyebrow">Aplicativo de Sorteio Online</p>
          <h1>Sala de Sorteios</h1>
        </div>
        <p>
          Cadastre-se para participar. Toda a experiencia
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
                <strong>{primaryWinner || '-'}</strong>
              </div>
            </div>

            <div className="winner-count">
              <label htmlFor="winner-count-select">Número de ganhadores</label>
              <select
                id="winner-count-select"
                value={winnerCount}
                onChange={(event) =>
                  setWinnerCount(Math.max(1, Number(event.target.value)))
                }
                disabled={isRacing}
              >
                {Array.from({ length: MAX_WINNERS }).map((_, index) => {
                  const value = index + 1
                  return (
                    <option key={value} value={value}>
                      {value} {value === 1 ? 'pessoa' : 'pessoas'}
                    </option>
                  )
                })}
              </select>
              <small>
                Serão sorteados até {winnerCount}{' '}
                {winnerCount === 1 ? 'vencedor' : 'vencedores'} únicos.
              </small>
            </div>

            <div className="panel__actions">
              <button
                className="primary"
                onClick={handleDraw}
                disabled={!canDraw || isRacing}
              >
                Sortear participante
              </button>
              <button
                className="ghost"
                onClick={handleReset}
                disabled={!winners.length || isRacing}
              >
                Limpar resultado
              </button>
              <button
                className="ghost ghost--danger"
                onClick={handleClearNonAdmins}
                disabled={!participants.length || isRacing}
              >
                Remover todos (exceto admin)
              </button>
              {!canDraw && (
                <span className="hint">
                  Sao necessarios pelo menos 2 participantes para o sorteio.
                </span>
              )}
              {isRacing && (
                <span className="hint">A corrida termina em 10 segundos.</span>
              )}
            </div>

            <RaceStatus
              isRacing={isRacing}
              winners={winners}
              raceProgress={raceProgress}
            />

            <RacingTrack
              racers={sortedParticipants}
              isRacing={isRacing}
              winners={winners}
              raceProgress={raceProgress}
            />
            <WinnersPodium winners={winners} />
          </section>

          <ParticipantsSection
            items={sortedParticipants}
            title="Lista de nomes"
            subtitle="Visualize todos os participantes."
            emptyMessage="Nenhum participante cadastrado ate agora."
            allowRemove
            onRemove={handleRemoveParticipant}
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
            <RaceStatus
              accent
              isRacing={isRacing}
              winners={winners}
              raceProgress={raceProgress}
            />
            <RacingTrack
              racers={sortedParticipants}
              isRacing={isRacing}
              winners={winners}
              raceProgress={raceProgress}
            />
            <p className="hint">
              Sempre que o administrador clicar em sortear, uma corrida de 10
              segundos acontece e define o pódio automaticamente.
            </p>
            <WinnersPodium winners={winners} />
          </section>

          <ParticipantsSection
            items={sortedParticipants}
            title="Participantes conectados"
            subtitle="Esta lista mostra quem se cadastrou na plataforma compartilhada."
            emptyMessage="Nenhum participante cadastrado ate agora."
            allowRemove={isAdmin}
            onRemove={handleRemoveParticipant}
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
              <p>Apenas administradores conseguem abrir o painel do administrador.</p>
              <button type="button" className="primary" onClick={closeAdminPrompt}>
                Entendi
              </button>
            </div>
          )}
        </div>
      )}

      {!isRegistered && hasHydrated && (
        <div className="overlay">
          <form className="identify" onSubmit={handleRegistration}>
            <h3>Identifique-se</h3>
            <p>
              O acesso exige que o participante informe o nome e entre na lista
              compartilhada.
            </p>
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


const ParticipantRow = ({ name, allowRemove, onRemove }) => {
  const adminInfo = findAdminByName(name)

  return (
    <li>
      <span className="participant-name">
        {adminInfo && <span className="participant-name__badge">👑</span>}
        {name}
      </span>
      {allowRemove && (
        <button
          type="button"
          className="link-button"
          onClick={() => onRemove?.(name)}
        >
          Remover
        </button>
      )}
    </li>
  )
}
