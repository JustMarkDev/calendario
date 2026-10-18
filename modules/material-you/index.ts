import { requireOptionalNativeModule } from 'expo';

const native = requireOptionalNativeModule<{ getColors(): Record<string, `#${string}`> | null }>('MaterialYou');

// null on iOS, web and Android before 12.
export const getMaterialColors = () => native?.getColors() ?? null;
