
export interface PhotoState {
  original: string | null;
  processed: string | null;
  isProcessing: boolean;
  error: string | null;
  detectedMP?: number;
  targetMP?: number;
}

export enum PhotographyStyle {
  PORTRAIT = 'Portrait (Shallow Depth)',
  PORTRAIT_MODE = 'Pro Portrait (AI Bokeh)',
  LANDSCAPE = 'Landscape (Crisp Detail)',
  MACRO = 'Macro (Extreme Close-up)',
  NIGHT = 'Night Mode (Enhanced ISO)',
  CINEMATIC = 'Cinematic (Color Graded)'
}

export enum ImageFilter {
  NONE = 'None',
  VINTAGE = 'Vintage Film',
  BW = 'Timeless B&W',
  SEPIA = 'Warm Sepia'
}

export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export interface EnhancementConfig {
  style: PhotographyStyle;
  bokehIntensity: number;
  contrastEnhancement: number;
  sharpening: number;
  filter: ImageFilter;
  aspectRatio: AspectRatio;
  shadowSuppression: number;
  removeCrowds: boolean;
  detectedShadows?: boolean;
  glitchDetected?: boolean;
  masterStrength: number;
  megaPixelUpscale: number; // 12 to 100
}
