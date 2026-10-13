export interface Profile {
  published?: boolean;
  name: string;
  description: string;
  paragraphs: string[];
  links?: { label: string; url: string }[];
}

export function publicProfile(profile: Profile | null): Profile | null {
  if (!profile) return null;
  if (profile.published !== undefined && typeof profile.published !== 'boolean') throw new Error('Me: published must be boolean');
  if (profile.published !== true) return null;
  if (![profile.name, profile.description, ...profile.paragraphs].every((text) => typeof text === 'string' && text.trim()) || !profile.paragraphs.length) throw new Error('Me: name, description and paragraphs are required');
  for (const link of profile.links ?? []) {
    if (!link.label.trim() || !/^https?:\/\//.test(link.url) || !URL.canParse(link.url)) throw new Error('Me: invalid public link');
  }
  return profile;
}
