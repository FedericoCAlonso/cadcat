import {
  type BayBoundingBox,
  type BayContent,
  type ModuleMaterialRoles,
} from './types';
import {
  type ComponentSolverOptions,
  type ComponentSolverResult,
  type IBayContentRegistry,
  defaultBayContentRegistry,
} from './resolvers';

export {
  type ComponentSolverOptions,
  type ComponentSolverResult,
};

export * from './resolvers';

/**
 * Resolves internal bay furniture components into pieces, joints, sub-assemblies, and placements.
 * Delegates component resolution to the registered BayContentResolver (adhering to SRP, OCP, and DIP).
 */
export function resolveBayContent(
  bay: BayBoundingBox,
  content: BayContent,
  materials: ModuleMaterialRoles,
  options: ComponentSolverOptions,
  registry: IBayContentRegistry = defaultBayContentRegistry,
): ComponentSolverResult {
  const resolver = registry.getResolver(content.type);

  if (!resolver) {
    return {
      pieces: [],
      joints: [],
      placementNodes: [],
      subAssemblies: [],
    };
  }

  return resolver.resolve({
    bay,
    content,
    materials,
    options,
  });
}
