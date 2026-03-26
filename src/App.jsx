import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import digitalHubLogo from './assets/digital-hub-logo.gif'
import carSpriteAtlas from './assets/140757-icone-dos-icones-carros-vetor.png'
import startBeepAudio from './assets/transcendedlifting-race-start-beeps-125125.mp3'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const SPIN_DURATION = 10000
const SERVER_SYNC_INTERVAL = 1000
const FALLBACK_START_SEQUENCE_DURATION = 2400
const MAX_WINNERS = 5
const RACE_START = 0.04
const RACE_PRE_FINISH = 0.9
const START_SIGNAL_STEPS = [
  { color: 'red', label: 'Preparar', caption: 'Primeiro bip' },
  { color: 'yellow', label: 'Atencao', caption: 'Segundo bip' },
  { color: 'green', label: 'Largada liberada', caption: 'Terceiro bip' },
]

const STORAGE_KEYS = {
  myName: 'sorteio:my-name',
  myCarId: 'sorteio:my-car-id',
}

const TABS = {
  user: 'user',
  admin: 'admin',
}

const ADMIN_RULES = [
  { name: 'Elizomar', password: '@5759#*', participates: true },
  { name: 'Hub-Zero', password: '@007#*', participates: false },
]

const CAR_MODELS = [
  { id: 'coupe-vintage', label: 'Coupe Vintage', row: 0, column: 0 },
  { id: 'sedan-executivo', label: 'Sedan Executivo', row: 0, column: 1 },
  { id: 'hatch-sprint', label: 'Hatch Sprint', row: 0, column: 2 },
  { id: 'city-mini', label: 'City Mini', row: 0, column: 3 },
  { id: 'classic-beetle', label: 'Classic Beetle', row: 1, column: 0 },
  { id: 'sedan-classico', label: 'Sedan Classico', row: 1, column: 1 },
  { id: 'sunset-cabrio', label: 'Sunset Cabrio', row: 1, column: 2 },
  { id: 'elegance-coupe', label: 'Elegance Coupe', row: 1, column: 3 },
  { id: 'retro-sedan', label: 'Retro Sedan', row: 2, column: 0 },
  { id: 'touring-wagon', label: 'Touring Wagon', row: 2, column: 1 },
  { id: 'pickup-force', label: 'Pickup Force', row: 2, column: 2 },
  { id: 'urban-suv', label: 'Urban SUV', row: 2, column: 3 },
  { id: 'family-van', label: 'Family Van', row: 3, column: 0 },
  { id: 'cargo-van', label: 'Cargo Van', row: 3, column: 1 },
  { id: 'trail-suv', label: 'Trail SUV', row: 3, column: 2 },
  { id: 'super-sport', label: 'Super Sport', row: 3, column: 3 },
]

const CAR_MODELS_BY_ID = Object.fromEntries(
  CAR_MODELS.map((model) => [model.id, model]),
)
const DEFAULT_CAR_MODEL = CAR_MODELS[0]

const normalizeName = (value = '') => value.trim().toLowerCase()

const findAdminByName = (value = '') => {
  const normalized = normalizeName(value)
  return ADMIN_RULES.find((admin) => admin.name.toLowerCase() === normalized)
}

const getCarModel = (carId = '') => CAR_MODELS_BY_ID[carId] ?? null
const getCarLabel = (carId = '') => getCarModel(carId)?.label ?? ''

const normalizeParticipant = (participant) => {
  if (typeof participant === 'string') {
    return { name: participant, carId: '', carLabel: '' }
  }

  const name =
    typeof participant?.name === 'string' ? participant.name.trim() : ''
  const resolvedCarId =
    typeof participant?.carId === 'string' && getCarModel(participant.carId)
      ? participant.carId
      : ''

  return {
    name,
    carId: resolvedCarId,
    carLabel:
      getCarLabel(resolvedCarId) ||
      (typeof participant?.carLabel === 'string' ? participant.carLabel : ''),
  }
}

const normalizeParticipants = (items) =>
  Array.isArray(items)
    ? items.map(normalizeParticipant).filter((participant) => participant.name)
    : []

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max)
const easeInOutSine = (value) => -(Math.cos(Math.PI * value) - 1) / 2
const easeOutCubic = (value) => 1 - (1 - value) ** 3

const getStableSeed = (value = '') => {
  let hash = 0

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000003
  }

  return (hash % 1000) / 1000
}

const getStartSignalState = (
  raceProgress,
  startSequenceDuration = FALLBACK_START_SEQUENCE_DURATION,
) => {
  const safeDuration = Math.max(startSequenceDuration, 1500)
  const elapsedMs = raceProgress * SPIN_DURATION
  const stepDuration = safeDuration / START_SIGNAL_STEPS.length
  const activeStepIndex = Math.min(
    Math.floor(elapsedMs / stepDuration),
    START_SIGNAL_STEPS.length - 1,
  )
  const activeStep = START_SIGNAL_STEPS[activeStepIndex]
  const normalized = Math.min(elapsedMs / safeDuration, 1)
  const greenStartAt = stepDuration * (START_SIGNAL_STEPS.length - 1)
  const greenStartProgress = Math.min(greenStartAt / SPIN_DURATION, 0.92)

  return {
    activeStep,
    activeStepIndex,
    normalized,
    safeDuration,
    greenStartProgress,
  }
}

const getRacePosition = ({
  name,
  index,
  movementProgress,
  winnerRank,
}) => {
  if (movementProgress <= 0) {
    return RACE_START
  }

  const seed = getStableSeed(name)
  const phase = seed * Math.PI * 2 + index * 0.73
  const cruisePhaseEnd = 0.86
  const packFinishLine = 0.82
  const cruiseProgress = clamp(movementProgress / cruisePhaseEnd)
  const packEasedProgress =
    cruiseProgress * 0.88 + easeInOutSine(cruiseProgress) * 0.12
  const packBase = RACE_START + packEasedProgress * (packFinishLine - RACE_START)

  const phaseOne = easeInOutSine(clamp(cruiseProgress / 0.34))
  const phaseTwo = easeInOutSine(clamp((cruiseProgress - 0.22) / 0.34))
  const phaseThree = easeInOutSine(clamp((cruiseProgress - 0.5) / 0.3))
  const sectionShift =
    Math.sin(phase) * 0.018 * phaseOne +
    Math.cos(phase * 1.13) * 0.016 * phaseTwo +
    Math.sin(phase * 1.37) * 0.014 * phaseThree

  const packPosition = clamp(
    packBase + sectionShift + (seed - 0.5) * 0.01 * cruiseProgress,
    RACE_START,
    packFinishLine + 0.03,
  )

  const finalStretchProgress = clamp((movementProgress - cruisePhaseEnd) / 0.14)
  const sprintDelay =
    winnerRank === 0
      ? 0
      : winnerRank > 0
        ? clamp(0.04 + winnerRank * 0.07, 0, 0.38)
        : 0.22 + seed * 0.12
  const orderedSprintProgress =
    winnerRank === 0
      ? finalStretchProgress
      : clamp((finalStretchProgress - sprintDelay) / (1 - sprintDelay))
  const finalTarget =
    winnerRank === 0
      ? 1
      : winnerRank > 0
        ? clamp(0.988 - winnerRank * 0.015, 0.95, 0.99)
        : clamp(0.94 + seed * 0.015, 0.94, 0.955)

  const sprintEase =
    winnerRank === 0
      ? easeOutCubic(orderedSprintProgress)
      : easeInOutSine(orderedSprintProgress)

  const position = packPosition * (1 - sprintEase) + finalTarget * sprintEase

  return clamp(position, RACE_START, 1)
}

const CarSprite = ({ carId, label, className = '', fallback = true }) => {
  const model = getCarModel(carId) ?? (fallback ? DEFAULT_CAR_MODEL : null)
  const classes = ['car-sprite']

  if (className) {
    classes.push(className)
  }

  if (!model) {
    classes.push('car-sprite--empty')
    return <span className={classes.join(' ')} aria-hidden="true" />
  }

  const backgroundPositionX = `${(model.column / 3) * 100}%`
  const backgroundPositionY = `${(model.row / 3) * 100}%`

  return (
    <span
      className={classes.join(' ')}
      style={{
        backgroundImage: `url(${carSpriteAtlas})`,
        backgroundPosition: `${backgroundPositionX} ${backgroundPositionY}`,
      }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
    />
  )
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
            key={normalizeName(participant.name)}
            participant={participant}
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

const RaceStatus = ({ isRacing, winners, startSignal, accent = false }) => {
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
      ? 'Campeoes da ultima corrida'
      : 'Nenhum resultado ainda'

  return (
    <div className={classes.join(' ')}>
      <p>{isRacing ? 'Semaforo sincronizado com o bip' : statusText}</p>
      {isRacing ? (
        <StartingLights startSignal={startSignal} />
      ) : (
        <strong>{winners.join(', ') || 'Aguardando corrida'}</strong>
      )}
    </div>
  )
}

const StartingLights = ({ startSignal }) => {
  return (
    <div className="lights" aria-live="assertive">
      <div className="lights__status">
        <strong>{startSignal.activeStep.label}</strong>
        <span>{startSignal.activeStep.caption}</span>
      </div>

      <div className="lights__row">
        {START_SIGNAL_STEPS.map((step, index) => {
          const isActive = index === startSignal.activeStepIndex
          const isPast = index < startSignal.activeStepIndex

          const classes = [`lights__dot`, `lights__dot--${step.color}`]
          if (isActive) {
            classes.push('lights__dot--active')
          }
          if (isPast) {
            classes.push('lights__dot--past')
          }

          return (
            <span
              key={step.color}
              className={classes.join(' ')}
              aria-label={step.label}
            />
          )
        })}
      </div>

      <div className="lights__meter" aria-hidden="true">
        <span style={{ transform: `scaleX(${startSignal.normalized})` }} />
      </div>
    </div>
  )
}

const RacingTrack = ({
  racers,
  winners,
  isRacing,
  raceProgress,
  startSignal,
}) => {
  if (!racers.length) {
    return <div className="track track--empty">Cadastre participantes</div>
  }

  const winnerRanks = new Map(
    winners.map((name, index) => [normalizeName(name), index]),
  )
  const hasResults = winners.length > 0
  const movementThreshold = startSignal.greenStartProgress
  const movementRange = 1 - movementThreshold

  return (
    <div className="track" role="list" aria-live="polite">
      {racers.map((participant, index) => {
        const normalized = normalizeName(participant.name)
        const winnerRank = winnerRanks.get(normalized) ?? -1
        const isWinner = winnerRank > -1

        let position = RACE_START
        let isMoving = false
        if (isRacing) {
          const movementProgress =
            raceProgress <= movementThreshold
              ? 0
              : Math.min(
                  (raceProgress - movementThreshold) / movementRange,
                  1,
                )
          isMoving = movementProgress > 0
          position = getRacePosition({
            name: normalized,
            index,
            movementProgress,
            winnerRank,
          })
        } else if (hasResults) {
          position =
            winnerRank === 0
              ? 1
              : winnerRank > 0
                ? clamp(0.97 - winnerRank * 0.028, RACE_PRE_FINISH, 0.99)
                : RACE_PRE_FINISH
        }

        return (
          <div
            className="track__lane"
            key={`${participant.name}-${index}`}
            role="listitem"
          >
            <div className="track__label">
              <strong>{participant.name}</strong>
              <span>{participant.carLabel || 'Modelo livre'}</span>
            </div>
            <div
              className={`track__road ${isMoving ? 'track__road--moving' : ''}`}
            >
              <div className="track__finish">FINISH</div>
              <div
                className={`track__car ${
                  isWinner ? 'track__car--winner' : ''
                } ${isMoving ? 'track__car--moving' : ''}`}
                style={{ left: `${position * 100}%` }}
              >
                <CarSprite
                  carId={participant.carId}
                  className="car-sprite--track"
                  label={`${participant.name} na pista`}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const WinnersPodium = ({ winners, participantLookup }) => {
  const labels = ['1o lugar', '2o lugar', '3o lugar']

  return (
    <div className="podium">
      {labels.map((label, index) => {
        const winnerName = winners[index] || ''
        const participant = winnerName
          ? participantLookup.get(normalizeName(winnerName))
          : null

        return (
          <div key={label} className="podium__item">
            <span>{label}</span>
            {winnerName ? (
              <div className="podium__winner">
                <CarSprite
                  carId={participant?.carId}
                  className="car-sprite--podium"
                  label={`${winnerName} no podio`}
                />
                <div>
                  <strong>{winnerName}</strong>
                  <small>{participant?.carLabel || 'Modelo livre'}</small>
                </div>
              </div>
            ) : (
              <strong>A definir</strong>
            )}
          </div>
        )
      })}
    </div>
  )
}

const WinnersModal = ({ winners, participantLookup, onClose }) => {
  const labels = ['1o lugar', '2o lugar', '3o lugar']

  return (
    <div className="overlay" role="presentation">
      <div
        className="identify winners-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="winners-modal-title"
      >
        <div className="winners-modal__header">
          <div>
            <span className="pill">Resultado da corrida</span>
            <h3 id="winners-modal-title">Ganhadores da rodada</h3>
          </div>
          <button type="button" className="ghost ghost--small" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="winners-modal__grid">
          {labels.map((label, index) => {
            const winnerName = winners[index] || ''
            const participant = winnerName
              ? participantLookup.get(normalizeName(winnerName))
              : null

            return (
              <div key={label} className="winners-modal__card">
                <span>{label}</span>
                {winnerName ? (
                  <>
                    <CarSprite
                      carId={participant?.carId}
                      className="car-sprite--modal"
                      label={`${winnerName} - ${label}`}
                    />
                    <strong>{winnerName}</strong>
                    <small>{participant?.carLabel || 'Modelo livre'}</small>
                  </>
                ) : (
                  <>
                    <div className="winners-modal__empty">-</div>
                    <strong>Nao sorteado</strong>
                    <small>Sem colocado nesta rodada</small>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const ParticipantRow = ({ participant, allowRemove, onRemove }) => {
  const adminInfo = findAdminByName(participant.name)

  return (
    <li>
      <div className="participant-card">
        <span className="participant-name">
          {adminInfo && <span className="participant-name__badge">ADM</span>}
          {participant.name}
        </span>
        <div className="participant-car">
          <CarSprite
            carId={participant.carId}
            className="car-sprite--mini"
            label={`${participant.name} - ${participant.carLabel || 'Modelo livre'}`}
          />
          <span>{participant.carLabel || 'Modelo nao definido'}</span>
        </div>
      </div>
      {allowRemove && (
        <button
          type="button"
          className="link-button"
          onClick={() => onRemove?.(participant.name)}
        >
          Remover
        </button>
      )}
    </li>
  )
}

const EntryScreen = ({
  nameInput,
  onNameChange,
  onSubmit,
  error,
  serverError,
  participantTotal,
  selectedCarId,
  onSelectCar,
  carSelectionRequired,
  onRetry,
}) => {
  const selectedCar = getCarModel(selectedCarId)

  return (
    <div className="entry-screen">
      <section className="entry-screen__hero">
        <div className="hero__brand">
          <img src={digitalHubLogo} alt="Logo animado da Digital Hub" />
          <div>
            <span>Equipe</span>
            <strong>Digital Hub P&C</strong>
          </div>
        </div>

        <div className="entry-screen__copy">
          <p className="hero__eyebrow">Sala de corrida para sorteio</p>
          <h1>Escolha seu carro antes de entrar no lobby</h1>
          <p>
            Cada participante entra com nome e modelo proprio para aparecer na
            pista compartilhada.
          </p>
        </div>

        <div className="entry-screen__stats">
          <div>
            <span className="pill">Participantes no lobby</span>
            <strong>{participantTotal}</strong>
          </div>
          <div>
            <span className="pill">Modelos disponiveis</span>
            <strong>{CAR_MODELS.length}</strong>
          </div>
        </div>
      </section>

      <form className="entry-card" onSubmit={onSubmit}>
        <div className="entry-card__header">
          <span className="entry-card__eyebrow">Entrada do participante</span>
          <h2>Monte sua vaga no grid</h2>
          <p>
            Informe seu nome e selecione um carro para liberar a entrada no
            lobby de participantes.
          </p>
        </div>

        {serverError && (
          <div className="alert alert--error" role="alert">
            <span>{serverError}</span>
            <button
              type="button"
              className="ghost ghost--small"
              onClick={onRetry}
            >
              Tentar novamente
            </button>
          </div>
        )}

        <label htmlFor="participant-name">Nome completo</label>
        <input
          id="participant-name"
          type="text"
          placeholder="Ex.: Maria Souza"
          value={nameInput}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="name"
        />

        <div className="entry-card__selected">
          <div>
            <span className="pill">Seu carro</span>
            <strong>
              {selectedCar?.label ||
                (carSelectionRequired
                  ? 'Selecione um modelo'
                  : 'Opcional para este perfil')}
            </strong>
            <p>
              {carSelectionRequired
                ? 'O carro escolhido sera usado na pista e na lista de participantes.'
                : 'Perfis administrativos sem participacao podem entrar sem definir um carro.'}
            </p>
          </div>
          <CarSprite
            carId={selectedCarId}
            className="car-sprite--entry"
            fallback={false}
            label={selectedCar?.label || ''}
          />
        </div>

        <div
          className="car-selector"
          role="radiogroup"
          aria-label="Selecione o modelo do carro"
        >
          {CAR_MODELS.map((model) => {
            const isSelected = model.id === selectedCarId

            return (
              <button
                key={model.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`car-option ${isSelected ? 'car-option--selected' : ''}`}
                onClick={() => onSelectCar(model.id)}
              >
                <CarSprite
                  carId={model.id}
                  className="car-sprite--selector"
                  label={model.label}
                />
                <strong>{model.label}</strong>
              </button>
            )
          })}
        </div>

        {error && <span className="error">{error}</span>}

        <button type="submit" className="primary">
          Entrar no lobby
        </button>
      </form>
    </div>
  )
}

function App() {
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [nameInput, setNameInput] = useState('')
  const [myName, setMyName] = useState('')
  const [selectedCarId, setSelectedCarId] = useState('')
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
  const [raceStartAt, setRaceStartAt] = useState(null)
  const [startSequenceDuration, setStartSequenceDuration] = useState(
    FALLBACK_START_SEQUENCE_DURATION,
  )
  const [showWinnersModal, setShowWinnersModal] = useState(false)
  const [winnerCount, setWinnerCount] = useState(1)
  const [authorizedAdminName, setAuthorizedAdminName] = useState('')

  const raceAnimationRef = useRef(null)
  const raceAudioRef = useRef(null)
  const playedRaceSoundRef = useRef(null)
  const displayedWinnersRaceRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedName = localStorage.getItem(STORAGE_KEYS.myName)
    const storedCarId = localStorage.getItem(STORAGE_KEYS.myCarId)

    if (storedName) {
      setMyName(storedName)
      setNameInput(storedName)
    }

    if (storedCarId && getCarModel(storedCarId)) {
      setSelectedCarId(storedCarId)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const audio = new Audio(startBeepAudio)
    audio.preload = 'auto'

    const syncAudioDuration = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        return
      }

      setStartSequenceDuration(Math.round(audio.duration * 1000))
    }

    if (audio.readyState >= 1) {
      syncAudioDuration()
    }

    audio.addEventListener('loadedmetadata', syncAudioDuration)
    raceAudioRef.current = audio

    return () => {
      audio.removeEventListener('loadedmetadata', syncAudioDuration)
      audio.pause()
      raceAudioRef.current = null
    }
  }, [])

  const fetchServerState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/participants`)
      if (!response.ok) {
        throw new Error('Failed to fetch participants')
      }

      const data = await response.json()
      setParticipants(normalizeParticipants(data.participants))
      setWinners(
        Array.isArray(data.winners)
          ? data.winners
          : data.winner
            ? [data.winner]
            : [],
      )
      setRaceStartAt(
        typeof data.raceStartAt === 'number' ? data.raceStartAt : null,
      )
      setServerError('')
    } catch {
      setServerError('Falha ao sincronizar com o servidor. Tente novamente.')
    } finally {
      setIsLoading(false)
      setHasHydrated(true)
    }
  }, [])

  useEffect(() => {
    fetchServerState()
    const interval = setInterval(fetchServerState, SERVER_SYNC_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchServerState])

  useEffect(() => {
    if (!raceStartAt) {
      if (raceAnimationRef.current) {
        cancelAnimationFrame(raceAnimationRef.current)
        raceAnimationRef.current = null
      }
      setIsRacing(false)
      setRaceProgress(0)
      displayedWinnersRaceRef.current = null
      return
    }

    setIsRacing(true)
    const startTime = Number(raceStartAt)

    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / SPIN_DURATION, 1)
      setRaceProgress(progress)

      if (progress < 1) {
        raceAnimationRef.current = requestAnimationFrame(tick)
      } else {
        setIsRacing(false)
        raceAnimationRef.current = null
        if (displayedWinnersRaceRef.current !== startTime) {
          displayedWinnersRaceRef.current = startTime
          setShowWinnersModal(true)
        }
      }
    }

    raceAnimationRef.current = requestAnimationFrame(tick)

    return () => {
      if (raceAnimationRef.current) {
        cancelAnimationFrame(raceAnimationRef.current)
        raceAnimationRef.current = null
      }
    }
  }, [raceStartAt])

  useEffect(() => {
    if (!raceStartAt || !raceAudioRef.current) {
      return
    }

    if (playedRaceSoundRef.current === raceStartAt) {
      return
    }

    const elapsed = Date.now() - raceStartAt
    const audioSyncWindow = Math.max(
      startSequenceDuration + SERVER_SYNC_INTERVAL,
      FALLBACK_START_SEQUENCE_DURATION,
    )

    if (elapsed > audioSyncWindow) {
      return
    }

    playedRaceSoundRef.current = raceStartAt
    raceAudioRef.current.currentTime = 0
    raceAudioRef.current.play().catch(() => {})
  }, [raceStartAt, startSequenceDuration])

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [participants])

  const participantLookup = useMemo(
    () =>
      new Map(
        sortedParticipants.map((participant) => [
          normalizeName(participant.name),
          participant,
        ]),
      ),
    [sortedParticipants],
  )
  const startSignal = useMemo(
    () => getStartSignalState(raceProgress, startSequenceDuration),
    [raceProgress, startSequenceDuration],
  )

  const normalizedMyName = normalizeName(myName)
  const currentAdminDefinition = useMemo(
    () => findAdminByName(normalizedMyName),
    [normalizedMyName],
  )
  const currentParticipant = participantLookup.get(normalizedMyName) ?? null
  const currentCarId = currentParticipant?.carId || selectedCarId
  const isAdminName = Boolean(currentAdminDefinition)
  const isAdminSpectator =
    currentAdminDefinition && !currentAdminDefinition.participates
  const isAdmin =
    activeTab === TABS.admin &&
    isAdminAuthorized &&
    currentAdminDefinition &&
    authorizedAdminName === currentAdminDefinition.name
  const primaryWinner = winners[0] || ''

  useEffect(() => {
    if (!currentParticipant?.carId || currentParticipant.carId === selectedCarId) {
      return
    }

    setSelectedCarId(currentParticipant.carId)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.myCarId, currentParticipant.carId)
    }
  }, [currentParticipant, selectedCarId])

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

  const isRegistered = useMemo(() => {
    if (!myName) {
      return false
    }

    if (isAdminSpectator) {
      return true
    }

    return participantLookup.has(normalizedMyName)
  }, [isAdminSpectator, myName, normalizedMyName, participantLookup])

  const requestedAdminInfo = useMemo(() => findAdminByName(nameInput), [nameInput])
  const carSelectionRequired = requestedAdminInfo?.participates !== false
  const shouldShowEntry =
    hasHydrated &&
    (!myName || !isRegistered || (!isAdminSpectator && !currentCarId))

  const handleRegistration = async (event) => {
    event.preventDefault()

    const normalizedName = nameInput.trim()
    if (!normalizedName) {
      setError('Informe um nome valido.')
      return
    }

    const adminInfo = findAdminByName(normalizedName)
    const chosenCarId = currentCarId || selectedCarId

    if (adminInfo?.participates !== false && !chosenCarId) {
      setError('Escolha um modelo de carro antes de entrar.')
      return
    }

    const canonicalName = adminInfo?.name || normalizedName

    if (adminInfo?.participates === false) {
      setError('')
      setMyName(canonicalName)
      setNameInput(canonicalName)
      setSelectedCarId('')
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.myName, canonicalName)
        localStorage.removeItem(STORAGE_KEYS.myCarId)
      }
      await fetchServerState()
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: canonicalName,
          carId: chosenCarId,
          carLabel: getCarLabel(chosenCarId),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to register participant')
      }

      const data = await response.json()
      setParticipants(normalizeParticipants(data.participants))
      setError('')
      setMyName(canonicalName)
      setNameInput(canonicalName)
      setSelectedCarId(chosenCarId)

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.myName, canonicalName)
        localStorage.setItem(STORAGE_KEYS.myCarId, chosenCarId)
      }

      await fetchServerState()
    } catch {
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
    setShowWinnersModal(false)

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

      setWinners(newWinners)
      setRaceStartAt(
        typeof data.raceStartAt === 'number' ? data.raceStartAt : Date.now(),
      )
    } catch {
      setRaceStartAt(null)
      setServerError('Nao foi possivel realizar o sorteio.')
    }
  }

  const handleReset = async () => {
    setIsRacing(false)
    setRaceProgress(0)
    setRaceStartAt(null)
    setShowWinnersModal(false)

    try {
      const response = await fetch(`${API_BASE_URL}/winner/reset`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to reset winner')
      }

      const data = await response.json()
      setWinners(
        Array.isArray(data.winners)
          ? data.winners
          : data.winner
            ? [data.winner]
            : [],
      )
      setRaceStartAt(
        typeof data.raceStartAt === 'number' ? data.raceStartAt : null,
      )
      await fetchServerState()
    } catch {
      setServerError('Nao foi possivel limpar o resultado.')
    }
  }

  const canDraw =
    participants.length >= Math.max(2, winnerCount) && winnerCount >= 1

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
      setParticipants(normalizeParticipants(data.participants))
      setWinners(Array.isArray(data.winners) ? data.winners : [])
      setRaceStartAt(
        typeof data.raceStartAt === 'number' ? data.raceStartAt : null,
      )
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
      setParticipants(normalizeParticipants(data.participants))
      setWinners(Array.isArray(data.winners) ? data.winners : [])
      setRaceStartAt(
        typeof data.raceStartAt === 'number' ? data.raceStartAt : null,
      )
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

  if (isLoading) {
    return (
      <div className="app">
        <section className="panel loading-panel" aria-live="polite">
          <p>Carregando informacoes do sorteio...</p>
        </section>
      </div>
    )
  }

  if (shouldShowEntry) {
    return (
      <div className="app app--entry">
        <EntryScreen
          nameInput={nameInput}
          onNameChange={setNameInput}
          onSubmit={handleRegistration}
          error={error}
          serverError={serverError}
          participantTotal={participants.length}
          selectedCarId={selectedCarId}
          onSelectCar={(carId) => {
            setSelectedCarId(carId)
            setError('')
          }}
          carSelectionRequired={carSelectionRequired}
          onRetry={fetchServerState}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__brand">
          <img src={digitalHubLogo} alt="Logo animado da Digital Hub" />
          <div>
            <span>Equipe</span>
            <strong>Digital Hub P&C</strong>
          </div>
        </div>
        <div>
          <p className="hero__eyebrow">Aplicativo de Sorteio Online</p>
          <h1>Sala de Sorteios</h1>
        </div>
        <p>
          Seu carro fica vinculado ao nome e entra na pista assim que voce
          aparece na lista compartilhada.
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
          <button
            type="button"
            className="ghost ghost--small"
            onClick={fetchServerState}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {isAdmin ? (
        <>
          <section className="panel admin-panel" aria-label="Painel do administrador">
            <div className="admin-panel__summary">
              <div>
                <span className="pill">Cadastrados</span>
                <strong>{participants.length}</strong>
              </div>
              {!isRacing && (
                <div>
                  <span className="pill">Ultimo sorteado</span>
                  <strong>{primaryWinner || '-'}</strong>
                </div>
              )}
            </div>

            <div className="winner-count">
              <label htmlFor="winner-count-select">Numero de ganhadores</label>
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
                Serao sorteados ate {winnerCount}{' '}
                {winnerCount === 1 ? 'vencedor' : 'vencedores'} unicos.
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
                <span className="hint">
                  Os carros largam no verde, sincronizados com o bip de largada.
                </span>
              )}
            </div>

            <RaceStatus
              isRacing={isRacing}
              winners={winners}
              startSignal={startSignal}
            />

            <RacingTrack
              racers={sortedParticipants}
              isRacing={isRacing}
              winners={winners}
              raceProgress={raceProgress}
              startSignal={startSignal}
            />
            {!isRacing && (
              <WinnersPodium
                winners={winners}
                participantLookup={participantLookup}
              />
            )}
          </section>

          <ParticipantsSection
            items={sortedParticipants}
            title="Lista de nomes"
            subtitle="Visualize todos os participantes e seus carros."
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
              navegador e voce entra no sorteio com o carro escolhido.
            </p>
            <div className="user-card__status">
              <div>
                <span className="pill">Seu status</span>
                <strong>{isRegistered ? 'Cadastrado' : 'Entrada pendente'}</strong>
              </div>
              <div className="user-card__vehicle">
                <span className="pill">Seu carro</span>
                <div className="user-card__vehicle-info">
                  <CarSprite
                    carId={currentCarId}
                    className="car-sprite--status"
                    fallback={false}
                    label={getCarLabel(currentCarId)}
                  />
                  <strong>{getCarLabel(currentCarId) || 'Nao definido'}</strong>
                </div>
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
              startSignal={startSignal}
            />
            <RacingTrack
              racers={sortedParticipants}
              isRacing={isRacing}
              winners={winners}
              raceProgress={raceProgress}
              startSignal={startSignal}
            />
            <p className="hint">
              Sempre que o administrador clicar em sortear, o semaforo avanca
              junto com o bip e os carros largam quando o verde acende.
              {isRacing && (
                <span className="hint__inline">
                  A pista ja esta sincronizada com a contagem de largada.
                </span>
              )}
            </p>
            {!isRacing && (
              <WinnersPodium
                winners={winners}
                participantLookup={participantLookup}
              />
            )}
          </section>

          <ParticipantsSection
            items={sortedParticipants}
            title="Participantes conectados"
            subtitle="Esta lista mostra quem se cadastrou e qual carro escolheu."
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
              <p>Digite a senha de seguranca para abrir o painel do administrador.</p>
              <label htmlFor="admin-password">Senha</label>
              <input
                id="admin-password"
                type="password"
                value={adminPassword}
                placeholder="******"
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

      {showWinnersModal && winners.length > 0 && (
        <WinnersModal
          winners={winners}
          participantLookup={participantLookup}
          onClose={() => setShowWinnersModal(false)}
        />
      )}
    </div>
  )
}

export default App
