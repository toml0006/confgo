import { avatarPresentation } from "@shared/domain";

export function avatarStyle(avatarId: number) {
  const { hue } = avatarPresentation(avatarId);
  return {
    background: `radial-gradient(circle at 28% 28%, hsla(${hue}, 90%, 72%, 0.9), hsla(${(hue + 35) % 360}, 80%, 35%, 0.32) 60%, rgba(5, 9, 18, 0.95) 100%)`,
    boxShadow: `0 0 20px hsla(${hue}, 90%, 65%, 0.28), inset 0 0 18px rgba(255,255,255,0.06)`
  };
}

