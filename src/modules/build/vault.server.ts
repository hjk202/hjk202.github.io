import { validateBuild } from './vault.schema.ts';
import { projects } from './data.ts';
export default function validate(value: unknown) {
  const payload = validateBuild(value);
  if (payload.supplements.some(entry=>!projects.some(project=>project.slug===entry.publicSlug))) throw new Error('Unknown public project');
  return payload;
}
