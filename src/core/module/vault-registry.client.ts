import type { PublicModule } from '../search/types.ts';
import type { VaultFactory } from '../vault/types.ts';
const definitions=import.meta.glob('../../modules/*/vault.client.ts',{eager:true,import:'default'});
export function vaultFactories(modules: readonly PublicModule[]): Map<string,VaultFactory> {
  const factories=new Map<string,VaultFactory>();
  for(const [file,value] of Object.entries(definitions)) {
    const id=file.split('/').at(-2)!;
    if(modules.some(module=>module.id===id)) {
      if(typeof value!=='function')throw new Error('Invalid Vault adapter');
      factories.set(id,value as VaultFactory);
    }
  }
  return factories;
}
