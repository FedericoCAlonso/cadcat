import {
  type IBayContentResolver,
  type IBayContentRegistry,
} from './types';
import { EmptyBayResolver } from './emptyBayResolver';
import { ShelvesBayResolver } from './shelvesBayResolver';
import { DrawerStackBayResolver } from './drawerStackBayResolver';
import { DoorsBayResolver } from './doorsBayResolver';
import { PullOutTrayBayResolver } from './pullOutTrayBayResolver';
import { BiFoldClosureBayResolver } from './biFoldClosureBayResolver';
import { SubdividedBayResolver } from './subdividedBayResolver';

export class BayContentRegistry implements IBayContentRegistry {
  private resolvers: Map<string, IBayContentResolver> = new Map();

  public constructor() {
    this.registerDefaults();
  }

  public register(resolver: IBayContentResolver): void {
    this.resolvers.set(resolver.type, resolver);
  }

  public getResolver(type: string): IBayContentResolver | undefined {
    return this.resolvers.get(type);
  }

  public getAll(): IBayContentResolver[] {
    return Array.from(this.resolvers.values());
  }

  private registerDefaults(): void {
    this.register(new EmptyBayResolver());
    this.register(new ShelvesBayResolver());
    this.register(new DrawerStackBayResolver());
    this.register(new DoorsBayResolver());
    this.register(new PullOutTrayBayResolver());
    this.register(new BiFoldClosureBayResolver());
    this.register(new SubdividedBayResolver());
  }
}

/**
 * Default global bay content resolver registry instance (OCP & DIP).
 */
export const defaultBayContentRegistry: BayContentRegistry = new BayContentRegistry();
