"""
This file contains all Pydantic Models used to specify how the LLM should format it's output
"""

from pydantic import BaseModel, Field, AfterValidator, model_validator
from typing import Optional, Annotated, List


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

####
