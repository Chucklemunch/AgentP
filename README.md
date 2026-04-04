# AgentP (in progress)
Developing a RAG-based Chat bot for physical therapy and rehabilitation

### [Helpful RAG tutorial from LangChain](https://docs.langchain.com/oss/python/langchain/rag#expand-for-full-code-snippet)

### Corpus
- [PMC Open Access](https://pmc.ncbi.nlm.nih.gov/tools/openftlist/)
- [APTA Clinical Practice Guidelines](https://www.apta.org/patient-care/evidence-based-practice-resources/cpgs)
    I need to figure out a way to access these

### Chunking Strategy
- [LangChain RecursiveCharacterTextSplitter](https://docs.langchain.com/oss/python/integrations/splitters)

### Embedding Strategy
- [LangChain OpenAIEmbeddings](https://docs.langchain.com/oss/python/integrations/text_embedding/openai)
- Model: "text-embedding-3-large"

### Vector Storage Strategy for proof of concept
- Qdrant
- Cluster Endpoint: https://62280a9a-32bb-4d0a-9e6e-99de68406473.us-east-1-1.aws.cloud.qdrant.io

# App Structure
- React + TS Frontend
- FastAPI Backend
