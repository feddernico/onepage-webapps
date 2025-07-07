/**
 * Saves an array of prompts to localStorage under the specified key.
 *
 * @param {string} promptsKey - The key under which the prompts will be stored in localStorage.
 * @param {Array} prompts - The array of prompt objects or strings to be saved.
 */
function savePrompts(promptsKey, prompts) {
    localStorage.setItem(promptsKey, JSON.stringify(prompts));
}


/**
 * Displays a list of prompts in the specified container element.
 *
 * @param {Array} savedPrompts - The array of prompt objects previously saved.
 * @param {HTMLElement} promptsList - The DOM element where prompt cards will be rendered.
 * @param {HTMLElement} noPromptsMessage - The DOM element to show when there are no prompts.
 *
 * @description
 * Clears the promptsList container and checks if there are any prompts to display.
 * If no prompts are available, shows the noPromptsMessage element.
 * Otherwise, hides the noPromptsMessage and renders each prompt as a card with title, creation date,
 * content, and tags. Each card also includes a delete button.
 */
function displayPrompts(savedPrompts, promptsList, noPromptsMessage) {
    promptsList.innerHTML = '';
    if (savedPrompts.length === 0) {
        noPromptsMessage.style.display = 'block';
        return;
    }
    noPromptsMessage.style.display = 'none';
    savedPrompts.forEach((prompt, index) => {
        const promptCard = document.createElement('div');
        promptCard.className = 'prompt-card bg-white p-6 rounded-lg shadow-md border border-gray-200';
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex justify-between items-start mb-2';
        
        const titleElement = document.createElement('h3');
        titleElement.className = 'text-xl font-semibold text-indigo-700';
        titleElement.textContent = prompt.title;
        headerDiv.appendChild(titleElement);
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-prompt-btn text-red-500 hover:text-red-700 font-semibold';
        deleteButton.setAttribute('data-id', index);
        deleteButton.textContent = 'Delete';
        headerDiv.appendChild(deleteButton);
        
        const createdAtElement = document.createElement('p');
        createdAtElement.className = 'text-gray-500 text-xs mb-3';
        createdAtElement.textContent = `Added: ${new Date(prompt.createdAt).toLocaleString()}`;
        
        const contentElement = document.createElement('div');
        contentElement.className = 'prompt-content-display text-gray-700 mb-4 whitespace-pre-wrap break-words';
        contentElement.textContent = prompt.content;
        
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        prompt.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            tagElement.textContent = tag;
            tagsContainer.appendChild(tagElement);
        });
        
        promptCard.appendChild(headerDiv);
        promptCard.appendChild(createdAtElement);
        promptCard.appendChild(contentElement);
        promptCard.appendChild(tagsContainer);
        promptsList.appendChild(promptCard);
    });
}