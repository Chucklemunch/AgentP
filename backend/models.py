"""
This file contains all Pydantic Models used to specify how the LLM should format it's output
"""

from datetime import datetime
from uuid import uuid4

from pydantic import BaseModel, Field, AfterValidator, model_validator
from typing import Optional, Annotated, List, Literal


#### Validators ####
def check_pmcid(pmcid: str) -> str:
    """
    Verifies that source and PMCID are valid
    """
    # TODO Verify PMCID with Entrez (probably)
    return pmcid
####

#### Models ####
class Metadata(BaseModel):
    """
    The Metadata class maps is identical fields to the metadata used to create the document chunks for RAG.
    This will allow for accurate citation verification against points in the Qdrant vector database
    """
    uid: str = Field("The UID of the article from which the evidence was extracted.")
    article: str = Field("The title of the article from which the evidence was extracted.")
    section: str = Field("The section of the article from which the evidence was extracted.")
    chunk_id: str = Field("The ID of the text chunk from which the evidence was extracted.")

    @model_validator(mode="after")
    def check_metadata(self) -> "Metadata":
        # TODO make sure that data exists in qdrant vector store
        return self

class Evidence(BaseModel):
    quote: str = Field(description="A singular piece of evidence supporting the physical therapy recommendation for the patient.")
    metadata: Annotated[Metadata, Field(description="The metadata associated with the text chunk from which the quote was extracted.")]

class Diagnosis(BaseModel):
    diagnosis: str = Field(description="A suggested diagnosis for the patient based on the problems they describe.")
    evidence: List[Evidence] = Field(description="A collection of evidence that supports the diagnosis")

class Recommendation(BaseModel):
    recommendation: str = Field(description="A thorough description of the recommendation for the patient")
    evidence: List[Evidence] = Field(description="A collection of pieces of evidence that support the recommendation.")

class PerryResponse(BaseModel):
    acknowledgement: str = Field(description="Acknowledge the users query, making them feel seen and understood in an empathetic tone.")
    info_summary: str = Field(description="A summary of the relevant information that the patient should receive based on their query.")
    diagnoses: Optional[List[Diagnosis]] = Field(description="One or more diagnoses given to the patient based on their symptoms, if symptoms are described. Do not give a diagnosis unless there is ample evidence to support it.")
    recommendations: Optional[List[Recommendation]] = Field(description="Recommendations given to the patient based on their inquiries and/or symptoms.")

class ChatRequest(BaseModel):
    message: str
    history: list

class UseRag(BaseModel):
    use_rag: bool = Field(description="Whether or not it would be ideal to use RAG to answer the user's query")

class Exercise(BaseModel):
    name: str = Field(description="The name of the exercise")
    sets: Optional[int] = Field(default=None, description="Number of sets. Use for resistance or strength exercises.")
    reps: Optional[int] = Field(default=None, description="Repetitions per set. Null if duration_seconds is used instead.")
    duration_seconds: Optional[int] = Field(default=None, description="Duration in seconds. Use for holds, stretches, or timed movements instead of reps.")
    suggested_rep_range: Optional[str] = Field(default=None, description="Suggested rep range as a string (e.g. '8-12', '15-20'). Use when a flexible range is more appropriate than a fixed rep count.")
    rir: Optional[int] = Field(default=None, description="Reps in reserve — how many reps short of failure the set should end. E.g. 2 means stop 2 reps before failure. Omit for rehab-stage or low-load exercises where pushing to near-failure is inappropriate.")
    frequency_per_week: int = Field(description="Number of times per week to perform this exercise")
    instructions: str = Field(description="Step-by-step instructions for performing the exercise with proper form")
    progression_notes: Optional[str] = Field(default=None, description="How to progress this exercise as strength or mobility improves")

class ExerciseProgram(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str = Field(description="A descriptive title for the exercise program")
    goal: str = Field(description="The primary rehabilitation or fitness goal of this program")
    exercises: List[Exercise] = Field(description="Ordered list of exercises comprising the program")
    total_weeks: int = Field(description="Total planned duration in weeks")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class ExerciseProgramExtraction(BaseModel):
    has_program: bool = Field(
        description="True only if the response contains a COMPLETE exercise program with multiple named exercises, specific parameters (sets/reps OR duration), and weekly frequency"
    )
    program: Optional[ExerciseProgram] = Field(default=None)

class LibraryExercise(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    default_sets: Optional[int] = None
    default_reps: Optional[int] = None
    default_duration_seconds: Optional[int] = None
    default_frequency_per_week: int
    instructions: str
    is_custom: bool = False

class CreateExerciseRequest(BaseModel):
    name: str
    default_sets: Optional[int] = None
    default_reps: Optional[int] = None
    default_duration_seconds: Optional[int] = None
    default_frequency_per_week: int
    instructions: str
####
