import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	openai_api_key: string;
	initial_prompt: string;
	model: string;
	[key: string]: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	openai_api_key: 'sk-...',
	initial_prompt: 'you are a helpful and smart assistant. you are given a text and you need to answer the question based on the text.',
	model: 'gpt-4o-mini'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'genie',
			name: 'Ask Genie',
			callback: () => {
				new AskLLMModal(this.app, this).open();
			}
		});
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class OpenAIAPI {
	private apiKey: string;
	private model: string;
	private initialPrompt: string;

	constructor(apiKey: string, model: string, initialPrompt: string) {
		this.apiKey = apiKey;
		this.model = model;
		this.initialPrompt = initialPrompt;
	}

	async query(context: string, question: string): Promise<string> {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.apiKey}`
			},
			body: JSON.stringify({
				model: this.model,
				messages: [
					{
						role: "system",
						content: this.initialPrompt
					},
					{
						role: "system",
						content: `context: ${context}`
					},
					{
						role: "user",
						content: question
					}
				]
			})
		});

		if (!response.ok) {
			let errorData;
			try {
				errorData = await response.json();
			} catch (error) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			throw new Error(errorData.error.message);
		}

		const data = await response.json();
		return data.choices[0].message.content;
	}
}

class AskLLMModal extends Modal {
	plugin: MyPlugin;
	private openai: OpenAIAPI;

	constructor(app: App, plugin: MyPlugin) {
		super(app);
		this.plugin = plugin;
		this.openai = new OpenAIAPI(
			plugin.settings.openai_api_key,
			plugin.settings.model,
			plugin.settings.initial_prompt
		);
	}

	onOpen() {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const current_file_content: string | undefined = markdownView?.data;
		if (!current_file_content) {
			this.close(); // I think we should just not open it in the first place if there is no text
			return;
		}
		const {contentEl} = this;
		
		// Create input container
		const inputContainer = contentEl.createDiv('input-container');
		inputContainer.style.marginBottom = '5px';

		// Create text input
		const textInput = inputContainer.createEl('textarea');
		
		textInput.placeholder = 'Enter your prompt here...';
		textInput.style.width = '100%';
		textInput.style.height = '100px';
		textInput.style.marginBottom = '2px';
		
		// Create output container and textarea
		const outputContainer = contentEl.createDiv('output-container');
		const outputArea = outputContainer.createEl('textarea');
		outputArea.placeholder = 'Response will appear here...';
		outputArea.style.width = '100%';
		outputArea.style.maxHeight = '300px';
		outputArea.style.marginBottom = '10px';
		outputArea.readOnly = true;
		outputArea.style.visibility = 'hidden';

		// Create submit button
		const buttonContainer = inputContainer.createDiv('button-container');
		buttonContainer.style.textAlign = 'center';
		const submitButton = buttonContainer.createEl('button', {text: 'Submit'});
		
		const submitPrompt = async () => {
			const prompt = textInput.value;
			console.log('Submitted prompt:', prompt);
			outputArea.style.visibility = 'visible';
			outputArea.value = 'Processing your request...';
			
			try {
				const response = await this.openai.query(current_file_content, prompt);
				outputArea.value = response;
			} catch (error) {
				console.error('Error:', error);
				new Notice(`Error: ${error.message}`);
				outputArea.style.visibility = 'hidden';  // Hide the output area on error
			}
		};

		// Update event listeners to handle async function
		submitButton.addEventListener('click', () => submitPrompt());
		textInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				submitPrompt();
			}
		});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Enter your OpenAI API key")
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.openai_api_key)
				.onChange(async (value) => {
					this.plugin.settings.openai_api_key = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Initial Prompt")
			.setDesc("Enter your initial prompt")
			.addTextArea(text => text
				.setPlaceholder('You are a helpful assistant...')
				.setValue(this.plugin.settings.initial_prompt)
				.onChange(async (value) => {
					this.plugin.settings.initial_prompt = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Model")
			.setDesc("Enter your model")
			.addText(text => text
				.setPlaceholder('gpt-4o-mini')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));
	}
}
