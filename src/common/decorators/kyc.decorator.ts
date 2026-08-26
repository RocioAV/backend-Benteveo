import { SetMetadata } from '@nestjs/common';

export const KYC_REQUIRED_KEY = 'kycRequired';

/** Marca un handler como requiriendo verificación KYC (isIdentityVerified). */
export const KycRequired = () => SetMetadata(KYC_REQUIRED_KEY, true);
