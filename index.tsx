/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from '@google/genai';

// --- DOM ELEMENT REFERENCES ---
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const fileNameSpan = document.getElementById('file-name') as HTMLSpanElement;
const originalImage = document.getElementById('original-image') as HTMLImageElement;
const comicStyleSelect = document.getElementById('comic-style') as HTMLSelectElement;
const keepBackgroundCheck = document.getElementById('keep-background') as HTMLInputElement;
const addFrameCheck = document.getElementById('add-frame') as HTMLInputElement;
const convertButton = document.getElementById('convert-button') as HTMLButtonElement;
const comicOutputDiv = document.getElementById('comic-output') as HTMLDivElement;
const downloadButton = document.getElementById('download-button') as HTMLAnchorElement;

// --- STATE ---
let uploadedFile: File | null = null;

// --- GEMINI SETUP ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash-image-preview';

// --- EVENT LISTENERS ---

fileInput.addEventListener('change', handleFileChange);
convertButton.addEventListener('click', handleConvertToComic);

// --- FUNCTIONS ---

/**
 * Handles the file input change event.
 * Reads the selected file, displays it, and enables the convert button.
 */
function handleFileChange() {
    if (fileInput.files && fileInput.files.length > 0) {
        uploadedFile = fileInput.files[0];
        fileNameSpan.textContent = uploadedFile.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage.src = e.target?.result as string;
        };
        reader.readAsDataURL(uploadedFile);

        convertButton.disabled = false;
        downloadButton.style.display = 'none';
        comicOutputDiv.innerHTML = '<div class="placeholder">Your comic version will appear here.</div>';
    }
}


/**
 * Converts a File object to a base64 encoded string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]); // remove prefix
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}


/**
 * Main function to handle the "Convert to Comic" button click.
 * It builds the prompt, calls the Gemini API, and displays the result.
 */
async function handleConvertToComic() {
    if (!uploadedFile) {
        alert('Please upload an image first.');
        return;
    }

    setLoadingState(true);

    try {
        const base64ImageData = await fileToBase64(uploadedFile);
        const mimeType = uploadedFile.type;
        const prompt = buildPrompt();

        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        
        displayResult(response.candidates[0].content.parts);

    } catch (error) {
        console.error("Error generating comic image:", error);
        comicOutputDiv.innerHTML = '<p style="color: red;">An error occurred. Please try again.</p>';
    } finally {
        setLoadingState(false);
    }
}

/**
 * Builds the text prompt for the Gemini API based on user selections.
 * @returns The constructed prompt string.
 */
function buildPrompt(): string {
    const baseInstruction = "Convert this photo into a clean, high-contrast comic illustration with inky outlines, simplified shading, and halftone texture. Preserve the subject’s identity and scene composition.";

    const styleMap: { [key: string]: string } = {
        'manga': 'Style it like black-and-white manga, with screentone halftone, fine linework, and dynamic speed lines.',
        'western': 'Style it like a classic Western comic, with bold ink lines, flat cel-shading, and CMYK halftone dots.',
        'pop-art': 'Style it like Pop-art, with a bright saturated palette, thick outlines, and prominent halftone dots for a poster look.',
        'cel-shade': 'Style it with a clean cel-shaded look, using minimal outlines, smooth cel shadows, and a soft background.'
    };

    let finalPrompt = baseInstruction;
    finalPrompt += ` ${styleMap[comicStyleSelect.value]}`;

    if (!keepBackgroundCheck.checked) {
        finalPrompt += " Replace the background with a clean white background.";
    }
    if (addFrameCheck.checked) {
        finalPrompt += " Add a classic comic book panel frame around the image, including a small empty caption box at the bottom.";
    }

    return finalPrompt;
}

/**
 * Displays the generated image result from the API response.
 * @param parts The parts array from the Gemini API response.
 */
function displayResult(parts: any[]) {
    const imagePart = parts.find(part => part.inlineData);

    if (imagePart) {
        const base64Image = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType;
        const imageUrl = `data:${mimeType};base64,${base64Image}`;

        comicOutputDiv.innerHTML = '';
        const img = new Image();
        img.src = imageUrl;
        img.alt = 'Generated comic-style image';
        comicOutputDiv.appendChild(img);
        
        downloadButton.href = imageUrl;
        downloadButton.style.display = 'inline-block';

    } else {
        comicOutputDiv.innerHTML = '<p>Could not generate an image from the response.</p>';
    }
}


/**
 * Toggles the loading state of the UI.
 * @param isLoading Whether to show or hide the loading state.
 */
function setLoadingState(isLoading: boolean) {
    convertButton.disabled = isLoading;
    if (isLoading) {
        convertButton.textContent = 'Converting...';
        comicOutputDiv.innerHTML = '<div class="spinner"></div>';
        downloadButton.style.display = 'none';
    } else {
        convertButton.textContent = 'Convert to Comic';
    }
}
