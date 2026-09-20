-- Align women_kyc.id_type CHECK with Bank KYC form enums.
ALTER TABLE public.women_kyc DROP CONSTRAINT IF EXISTS women_kyc_id_type_check;

ALTER TABLE public.women_kyc
  ADD CONSTRAINT women_kyc_id_type_check
  CHECK (id_type IN (
    'aadhaar',
    'pan',
    'passport',
    'voter_id',
    'driving_license',
    'ration_card',
    'college_id',
    'government_id',
    'nrega_card',
    'defence_id',
    'postal_id'
  ));
