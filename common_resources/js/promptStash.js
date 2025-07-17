/**
 * Generates a unique identifier string.
 * 
 * @returns {string} A unique identifier string.
 */
function generateId() {
    return Math.random().toString(36).substring(2, 11);
}

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

/**
 * Enhanced Prompt Stash Application
 * Manages prompts and projects with localStorage persistence
 */
if (typeof window.PromptStashApp === 'undefined') {
    window.PromptStashApp = class PromptStashApp {
        constructor() {
            this.STORAGE_KEYS = {
                prompts: 'promptStashPrompts',
                projects: 'promptStashProjects'
            };

            this.savedPrompts = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.prompts)) || [];
            this.savedProjects = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.projects)) || [];
            this.currentProject = 'all';
            this.selectedColor = '#3B82F6';
            this.deleteTarget = null;

            this.initializeElements();
        }

        initializeElements() {
            this.sidebar = document.getElementById('sidebar');
            this.mainContent = document.getElementById('mainContent');
            this.toggleSidebar = document.getElementById('toggleSidebar');
            this.closeSidebar = document.getElementById('closeSidebar');
            this.projectsList = document.getElementById('projectsList');
            this.promptsList = document.getElementById('promptsList');
            this.noPromptsMessage = document.getElementById('noPromptsMessage');
            this.newProjectModal = document.getElementById('newProjectModal');
            this.deleteConfirmationModal = document.getElementById('deleteConfirmationModal');
        }

        init() {
            this.setupEventListeners();
            this.renderProjects();
            this.renderPrompts();
            this.updateProjectSelector();
            this.updateCounts();
        }

        setupEventListeners() {
            // Sidebar toggles
            this.toggleSidebar.addEventListener('click', () => {
                this.sidebar.classList.toggle('collapsed');
                this.mainContent.classList.toggle('sidebar-open');
            });

            this.closeSidebar.addEventListener('click', () => {
                this.sidebar.classList.add('collapsed');
                this.mainContent.classList.remove('sidebar-open');
            });

            // New project
            document.getElementById('newProjectBtn').addEventListener('click', () => {
                this.newProjectModal.classList.add('show');
            });

            document.getElementById('cancelNewProject').addEventListener('click', () => {
                this.newProjectModal.classList.remove('show');
                this.resetNewProjectForm();
            });

            document.getElementById('createProjectBtn').addEventListener('click', () => {
                this.createProject();
            });

            // Color selection
            document.getElementById('colorOptions').addEventListener('click', (e) => {
                if (e.target.classList.contains('color-option')) {
                    document.querySelectorAll('.color-option').forEach(option => {
                        option.classList.remove('selected');
                    });
                    e.target.classList.add('selected');
                    this.selectedColor = e.target.dataset.color;
                }
            });

            // Add prompt
            document.getElementById('addPromptBtn').addEventListener('click', () => {
                this.addPrompt();
            });

            // Delete confirmations
            document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
                this.confirmDelete();
            });

            document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
                this.deleteConfirmationModal.classList.remove('show');
            });

            // Modal close on outside click
            window.addEventListener('click', (e) => {
                if (e.target === this.newProjectModal) {
                    this.newProjectModal.classList.remove('show');
                    this.resetNewProjectForm();
                }
                if (e.target === this.deleteConfirmationModal) {
                    this.deleteConfirmationModal.classList.remove('show');
                }
            });

            // Project selection
            this.sidebar.addEventListener('click', (e) => {
                const projectItem = e.target.closest('.project-item');
                if (projectItem) {
                    this.selectProject(projectItem.dataset.project);
                }
            });

            // Prompt actions
            this.promptsList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-prompt-btn')) {
                    this.deleteTarget = {
                        type: 'prompt',
                        id: e.target.dataset.id
                    };
                    document.getElementById('deleteMessage').textContent = 'Are you sure you want to delete this prompt? This action cannot be undone.';
                    this.deleteConfirmationModal.classList.add('show');
                }
            });
        }

        saveToStorage() {
            localStorage.setItem(this.STORAGE_KEYS.prompts, JSON.stringify(this.savedPrompts));
            localStorage.setItem(this.STORAGE_KEYS.projects, JSON.stringify(this.savedProjects));
        }

        createProject() {
            const name = document.getElementById('newProjectName').value.trim();
            if (!name) {
                alert('Project name cannot be empty!');
                return;
            }

            const newProject = {
                id: generateId(),
                name: name,
                color: this.selectedColor,
                createdAt: new Date().toISOString()
            };

            this.savedProjects.push(newProject);
            this.saveToStorage();
            this.renderProjects();
            this.updateProjectSelector();
            this.updateCounts();
            this.newProjectModal.classList.remove('show');
            this.resetNewProjectForm();
        }

        resetNewProjectForm() {
            document.getElementById('newProjectName').value = '';
            document.querySelectorAll('.color-option').forEach(option => {
                option.classList.remove('selected');
            });
            document.querySelector('.color-option[data-color="#3B82F6"]').classList.add('selected');
            this.selectedColor = '#3B82F6';
        }

        renderProjects() {
            this.projectsList.innerHTML = '';
            this.savedProjects.forEach(project => {
                const projectElement = document.createElement('div');
                projectElement.className = 'project-item px-4 py-3 rounded-lg cursor-pointer mb-2';
                projectElement.dataset.project = project.id;

                const promptCount = this.savedPrompts.filter(prompt => prompt.projectId === project.id).length;

                projectElement.innerHTML = `
                    <div class="flex items-center">
                        <div class="w-3 h-3 rounded-full mr-3" style="background-color: ${project.color}"></div>
                        <span class="font-medium text-gray-700">${project.name}</span>
                        <span class="ml-auto text-sm text-gray-500">${promptCount}</span>
                    </div>
                    <button class="delete-project-btn text-red-400 hover:text-red-600 text-xs mt-1 opacity-0 hover:opacity-100 transition-opacity" 
                            data-id="${project.id}">
                        Delete Project
                    </button>
                `;

                // Add event listener for delete button
                const deleteBtn = projectElement.querySelector('.delete-project-btn');
                deleteBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.deleteProject(project.id);
                });

                this.projectsList.appendChild(projectElement);
            });
        }

        deleteProject(projectId) {
            this.deleteTarget = {
                type: 'project',
                id: projectId
            };
            const project = this.savedProjects.find(p => p.id === projectId);
            const promptCount = this.savedPrompts.filter(prompt => prompt.projectId === projectId).length;
            document.getElementById('deleteMessage').textContent =
                `Are you sure you want to delete "${project.name}"? This will also unassign ${promptCount} prompt(s) from this project.`;
            this.deleteConfirmationModal.classList.add('show');
        }

        confirmDelete() {
            if (this.deleteTarget.type === 'prompt') {
                this.savedPrompts.splice(parseInt(this.deleteTarget.id), 1);
            } else if (this.deleteTarget.type === 'project') {
                this.savedProjects = this.savedProjects.filter(p => p.id !== this.deleteTarget.id);
                // Unassign prompts from deleted project
                this.savedPrompts.forEach(prompt => {
                    if (prompt.projectId === this.deleteTarget.id) {
                        prompt.projectId = null;
                    }
                });
                // Switch to "All Prompts" if current project was deleted
                if (this.currentProject === this.deleteTarget.id) {
                    this.selectProject('all');
                }
            }

            this.saveToStorage();
            this.renderProjects();
            this.renderPrompts();
            this.updateProjectSelector();
            this.updateCounts();
            this.deleteConfirmationModal.classList.remove('show');
        }

        updateProjectSelector() {
            const selector = document.getElementById('promptProject');
            selector.innerHTML = '<option value="">Unassigned</option>';

            this.savedProjects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                selector.appendChild(option);
            });
        }

        selectProject(projectId) {
            this.currentProject = projectId;

            // Update active state
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.remove('active');
            });
            const projectElement = document.querySelector(`[data-project="${projectId}"]`);
            if (projectElement) {
                projectElement.classList.add('active');
            }

            // Update title
            const titleElement = document.getElementById('currentProjectTitle');
            const countElement = document.getElementById('currentProjectCount');

            if (projectId === 'all') {
                titleElement.textContent = 'All Prompts';
                countElement.textContent = `${this.savedPrompts.length} prompts`;
            } else if (projectId === 'unassigned') {
                titleElement.textContent = 'Unassigned';
                const count = this.savedPrompts.filter(p => !p.projectId).length;
                countElement.textContent = `${count} prompts`;
            } else {
                const project = this.savedProjects.find(p => p.id === projectId);
                titleElement.textContent = project.name;
                const count = this.savedPrompts.filter(p => p.projectId === projectId).length;
                countElement.textContent = `${count} prompts`;
            }

            this.renderPrompts();
        }

        addPrompt() {
            const title = document.getElementById('promptTitle').value.trim();
            const content = document.getElementById('promptContent').value.trim();
            const tags = document.getElementById('promptTags').value.trim()
                .split(',').map(tag => tag.trim()).filter(tag => tag);
            const projectId = document.getElementById('promptProject').value || null;

            const errorMessageElement = document.getElementById('formErrorMessage');
            if (!title || !content) {
                errorMessageElement.textContent = 'Title and Content cannot be empty!';
                errorMessageElement.style.display = 'block';
                return;
            }
            errorMessageElement.style.display = 'none';
            errorMessageElement.textContent = '';

            const newPrompt = {
                id: generateId(),
                title,
                content,
                tags,
                projectId,
                createdAt: new Date().toISOString()
            };

            this.savedPrompts.push(newPrompt);
            this.saveToStorage();
            this.renderPrompts();
            this.updateCounts();

            // Clear form
            document.getElementById('promptTitle').value = '';
            document.getElementById('promptContent').value = '';
            document.getElementById('promptTags').value = '';
            document.getElementById('promptProject').value = '';
        }

        renderPrompts() {
            const filteredPrompts = this.getFilteredPrompts();
            this.promptsList.innerHTML = '';

            if (filteredPrompts.length === 0) {
                this.noPromptsMessage.style.display = 'block';
                return;
            }

            this.noPromptsMessage.style.display = 'none';

            filteredPrompts.forEach((prompt, index) => {
                const actualIndex = this.savedPrompts.findIndex(p => p.id === prompt.id);
                const project = prompt.projectId ? this.savedProjects.find(p => p.id === prompt.projectId) : null;

                const promptCard = document.createElement('div');
                promptCard.className = 'prompt-card bg-white p-6 rounded-lg shadow-md border border-gray-200';

                promptCard.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-semibold text-indigo-700">${prompt.title}</h3>
                        <button class="delete-prompt-btn text-red-500 hover:text-red-700 font-semibold" data-id="${actualIndex}">
                            Delete
                        </button>
                    </div>
                    <div class="flex items-center mb-2">
                        <p class="text-gray-500 text-xs">Added: ${new Date(prompt.createdAt).toLocaleString()}</p>
                        ${project ? `<span class="ml-4 text-xs px-2 py-1 rounded-full text-white" style="background-color: ${project.color}">${project.name}</span>` : ''}
                    </div>
                    <div class="prompt-content-display text-gray-700 mb-4 whitespace-pre-wrap break-words">
                        ${prompt.content}
                    </div>
                    <div class="tags-container">
                        ${prompt.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                `;

                this.promptsList.appendChild(promptCard);
            });
        }

        getFilteredPrompts() {
            if (this.currentProject === 'all') {
                return this.savedPrompts;
            } else if (this.currentProject === 'unassigned') {
                return this.savedPrompts.filter(prompt => !prompt.projectId);
            } else {
                return this.savedPrompts.filter(prompt => prompt.projectId === this.currentProject);
            }
        }

        updateCounts() {
            document.getElementById('allPromptsCount').textContent = this.savedPrompts.length;
            document.getElementById('unassignedCount').textContent =
                this.savedPrompts.filter(p => !p.projectId).length;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!window.promptStashApp) {
        window.promptStashApp = new window.PromptStashApp();
        window.promptStashApp.init();
    }
});