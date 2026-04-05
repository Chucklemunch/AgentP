"""
Utility functions for improving code modularity
"""

import os
from models import PerryResponse
from pydantic_ai import RunContext, Agent
from pydantic_ai.messages import ModelMessage

### Create agent for summarizing message history ###
summarizer_agent = Agent(
    'openai:gpt-5-mini',
    instructions="""
Summarize this conversation, omitting small talk and unrelated topics.
Focus on the technical discussion and next steps.
""",
)


async def summarize_messages(
        ctx: RunContext[None],
        messages: list[ModelMessage]
    ) -> list[ModelMessage]:
    """
    Summarizes oldest messages in history and appends it to the end of the newest messages
    """

    # Check token usage
    current_tokens = ctx.usage.total_tokens
    if current_tokens > 16000:
        summary = await summarizer_agent.run(message_history=messages)
        summarized_messages = summary.new_messages() + messages[-1:]
        return summarized_messages

    return messages


def format_perry_output(response: PerryResponse):
    """Takes the PerryResponse model and makes it a more human-like response"""
    recs = response.recommendations
    diagnoses = response.diagnoses

    recs_str = None
    if recs is not None:
        recs_joined = '\n- '.join(rec.recommendation for rec in recs)
        recs_str = f"""
Here are some recommendations for you:
- {recs_joined}

       """
    diags_str = None
    if diagnoses is not None:
        diags_joined = '\n- '.join(diag.diagnosis for diag in diagnoses)
        diags_str = f"""
Here are some potential diagnoses for you to consider:
- {diags_joined}
        """

    perry_response = f"""
{response.acknowledgement}
{response.info_summary}
{recs_str if recs is not None else ''}
{diags_str if diagnoses is not None else ''}
"""

    return perry_response



def get_system_prompt(system_prompt_version: str, prompt_reg_dir: str):
    """
    Gets system prompt based on version

    Args:
        system_prompt_version (str): system prompt version to retreive
        prompt_reg_dir (str): path to system prompt registry

    Returns:
        system_prompt (str): The system prompt associated with the provided version
    """

    system_prompt = None

    # Make prompt path
    prompt_path_dir = prompt_reg_dir + system_prompt_version
    prompt_path = f'{prompt_path_dir}/system_prompt_{system_prompt_version}.md'

    # Check if version exists
    if os.path.exists(prompt_path):
        with open(prompt_path, 'r') as f:
            system_prompt = f.read()

    return system_prompt


