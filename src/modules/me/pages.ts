import type { ModulePage } from '../../core/module/types';
import Profile from './Profile.astro';
import { profile } from './data';
export default [{ path: '', component: Profile, props: {}, head: { title: profile ? `${profile.name} — Me` : 'Me', description: profile?.description ?? '暂无公开介绍。' } }] satisfies ModulePage[];
