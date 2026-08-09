
import { GoogleGenAI, Type } from "@google/genai";
import { PhotographyStyle, EnhancementConfig, ImageFilter, AspectRatio } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeImageForEnhancement = async (
  base64Image: string
): Promise<Partial<EnhancementConfig> & { detectedMP: number, targetMP: number }> => {
  const ai = getAI();
  const imageData = base64Image.split(',')[1] || base64Image;

  const prompt = `
    Analyze this photo captured by a budget mobile sensor (likely 8-12MP hardware).
    1. Estimate perceived Megapixel quality (detectedMP) based on noise, sensor blur, and artifacting.
    2. Recommend a target Megapixel upscale (targetMP) between 24 and 100 for DSLR-quality detail reconstruction.
    3. Choose style: PORTRAIT, PORTRAIT_MODE, LANDSCAPE, MACRO, NIGHT, CINEMATIC.
    4. Suggest 0-100 values for bokehIntensity, contrastEnhancement, sharpening, and megaPixelUpscale.
    5. DETECT SENSOR GLITCHES: Scan for digital noise and pixelated shadows.
    6. DETECT HARSH SHADOWS.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { data: imageData, mimeType: "image/jpeg" } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            styleKey: { type: Type.STRING },
            bokehIntensity: { type: Type.NUMBER },
            contrastEnhancement: { type: Type.NUMBER },
            sharpening: { type: Type.NUMBER },
            detectedShadows: { type: Type.BOOLEAN },
            glitchDetected: { type: Type.BOOLEAN },
            suggestedShadowSuppression: { type: Type.NUMBER },
            detectedMP: { type: Type.NUMBER },
            targetMP: { type: Type.NUMBER },
            megaPixelUpscale: { type: Type.NUMBER },
          },
          required: ["styleKey", "bokehIntensity", "contrastEnhancement", "sharpening", "detectedShadows", "glitchDetected", "suggestedShadowSuppression", "detectedMP", "targetMP", "megaPixelUpscale"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    const styleMap: Record<string, PhotographyStyle> = {
      PORTRAIT: PhotographyStyle.PORTRAIT,
      PORTRAIT_MODE: PhotographyStyle.PORTRAIT_MODE,
      LANDSCAPE: PhotographyStyle.LANDSCAPE,
      MACRO: PhotographyStyle.MACRO,
      NIGHT: PhotographyStyle.NIGHT,
      CINEMATIC: PhotographyStyle.CINEMATIC,
    };

    return {
      style: styleMap[result.styleKey] || PhotographyStyle.PORTRAIT,
      bokehIntensity: Math.min(100, Math.max(0, result.bokehIntensity)),
      contrastEnhancement: Math.min(100, Math.max(0, result.contrastEnhancement)),
      sharpening: Math.min(100, Math.max(0, result.sharpening)),
      detectedShadows: result.detectedShadows,
      glitchDetected: result.glitchDetected,
      shadowSuppression: result.detectedShadows ? result.suggestedShadowSuppression : 0,
      megaPixelUpscale: result.megaPixelUpscale,
      detectedMP: result.detectedMP,
      targetMP: result.targetMP,
    };
  } catch (error) {
    console.error("Analysis Error:", error);
    throw new Error("Failed to analyze image for auto-enhancement.");
  }
};

export const enhanceToDSLR = async (
  base64Image: string,
  config: EnhancementConfig
): Promise<string> => {
  const ai = getAI();
  const imageData = base64Image.split(',')[1] || base64Image;

  const stylePrompts: Record<PhotographyStyle, string> = {
    [PhotographyStyle.PORTRAIT]: "Create a razor-sharp focus on the primary subject. Apply a sophisticated, multi-layered bokeh background mimic a high-end 85mm f/1.2 lens.",
    [PhotographyStyle.PORTRAIT_MODE]: "Aggressive Pro Portrait Mode: Isolate the human subject with precise edge detection. Apply extreme creamy background blur (bokeh) that realistically rolls off from the focal plane. Simulate a full-frame sensor's shallow depth of field.",
    [PhotographyStyle.LANDSCAPE]: "Expand dynamic range and apply extreme clarity to distant textures. Neutralize cheap sensor haze.",
    [PhotographyStyle.MACRO]: "Simulate a specialized macro lens with an incredibly thin focal plane focusing on microscopic textures.",
    [PhotographyStyle.NIGHT]: "Clean up low-light chroma noise. Artificially reconstruct details in dark areas as if captured with a high-ISO full-frame sensor.",
    [PhotographyStyle.CINEMATIC]: "Apply a high-end Hollywood color grade (Teal/Orange). Add subtle anamorphic characteristics."
  };

  const resolutionPrompt = `MEGAPIXEL RECONSTRUCTION: Perform generative super-resolution upscaling to simulate a ${config.megaPixelUpscale}MP full-frame CMOS sensor. Synthesize high-frequency details like skin pores, fabric textures, and sharp foliage edges that were lost in the original budget mobile sensor.`;

  const prompt = `
    ACT AS A MASTER PHOTO EDITOR & SENSOR ENGINEER. 
    Transform this budget phone photo into a DSLR masterpiece.
    
    Style: ${config.style}.
    
    Instructions:
    - ${stylePrompts[config.style]}
    - ${resolutionPrompt}
    - SHADOW NEUTRALIZATION: ${config.shadowSuppression}% intensity. Soften harsh digital shadows.
    - GLITCH PATCHING: Remove mobile sensor artifacts and digital noise.
    - Contrast: ${config.contrastEnhancement}% 
    - Sharpness: ${config.sharpening}%
    - Target: Professional Full-Frame, high-resolution output.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: imageData, mimeType: 'image/jpeg' } },
          { text: prompt },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio
        }
      }
    });

    let resultImageUrl = '';
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          resultImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!resultImageUrl) throw new Error("No image was generated.");
    return resultImageUrl;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("High-end rendering failed. Check your connection.");
  }
};
