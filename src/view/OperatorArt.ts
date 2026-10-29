import { OPERATOR_DB } from '../config/gameData';

const portraits = new Map<string, HTMLImageElement>();

export function portraitUrl(templateId: string): string | null {
  const path = OPERATOR_DB[templateId]?.portrait;
  return path ? `${import.meta.env.BASE_URL}${path}` : null;
}

export function loadedPortrait(templateId: string): HTMLImageElement | null {
  const url = portraitUrl(templateId);
  if (!url) return null;
  let image = portraits.get(templateId);
  if (!image) {
    image = new Image();
    image.src = url;
    portraits.set(templateId, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}
