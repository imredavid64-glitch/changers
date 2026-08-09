import { buildSearchIndex } from "@/lib/social/utils";

export function buildDocumentSearchIndex(title: string, body: string): string {
  return buildSearchIndex([title, body]);
}

export function buildSlideshowSearchIndex(
  title: string,
  slides: { heading: string; body: string }[],
): string {
  return buildSearchIndex([
    title,
    slides.flatMap((slide) => [slide.heading, slide.body]),
  ]);
}

export function buildTableSearchIndex(title: string, data: string[][]): string {
  return buildSearchIndex([title, data.flatMap((row) => row)]);
}

export function buildCodeSearchIndex(title: string, language: string, code: string): string {
  return buildSearchIndex([title, language, code]);
}

export function buildDesignSearchIndex(title: string): string {
  return buildSearchIndex([title]);
}

export function buildFilmSearchIndex(
  title: string,
  scenes: { setting: string; description: string; dialogue: string }[],
): string {
  return buildSearchIndex([
    title,
    scenes.flatMap((scene) => [scene.setting, scene.description, scene.dialogue]),
  ]);
}