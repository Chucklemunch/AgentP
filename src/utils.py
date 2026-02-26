"""
Utility functions for improving code modularity
"""

import os

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
    prompt_path = f'{prompt_path_dir}/{system_prompt_version}.txt'
    print(f'prompt_path: {prompt_path}')

    # Check if version exists
    if os.path.exists(prompt_path):
        with open(prompt_path, 'r') as f:
            system_prompt = f.read()

            print(f'System prompt {system_prompt_version} found: \n\n {system_prompt}')

    return system_prompt



