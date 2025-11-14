import random
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Sorteio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParticipantPayload(BaseModel):
    name: str


participants: List[str] = []
current_winner: str = ""


@app.get("/participants")
def list_participants():
    return {"participants": participants, "winner": current_winner}


@app.post("/participants", status_code=201)
def add_participant(payload: ParticipantPayload):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome e obrigatorio.")

    normalized = name.lower()
    for registered in participants:
        if registered.lower() == normalized:
            return {"participants": participants, "winner": current_winner}

    participants.append(name)
    return {"participants": participants, "winner": current_winner}


@app.post("/draw")
def draw_winner():
    if len(participants) < 2:
        raise HTTPException(
            status_code=400,
            detail="Sao necessarios pelo menos dois participantes.",
        )

    global current_winner
    current_winner = random.choice(participants)
    return {"winner": current_winner}


@app.post("/winner/reset")
def reset_winner():
    global current_winner
    current_winner = ""
    return {"winner": current_winner}


@app.get("/health")
def health_check():
    return {"status": "ok", "totalParticipants": len(participants)}
