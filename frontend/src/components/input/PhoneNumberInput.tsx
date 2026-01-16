import {
  useState,
  ChangeEvent,
} from 'react';

import {
  TextField,
  TextFieldProps,
} from '@mui/material';

export type PhoneNumberInputProps = TextFieldProps & {
  onValidationChange?: (isValid: boolean) => void;
  errorText?: string;
  phoneRegex?: RegExp;
};

export const PhoneNumberInput = ({
                                   onChange,
                                   onValidationChange,
                                   phoneRegex = /^\+[1-9]\d{1,14}$/,
                                   errorText = "Invalid format. Use E.164 (e.g., +1234567890)",
                                   ...props
                                 }: PhoneNumberInputProps) => {
  const [internalError, setInternalError] = useState(false);

  const handleInternalChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const isValid = phoneRegex.test(newValue);

    // 1. Update internal visual state
    setInternalError(!isValid && newValue.length > 0);

    // 2. Notify parent of validity status separately
    onValidationChange?.(isValid);

    // 3. Emit the standard ChangeEvent to the parent's existing handleChange
    onChange?.(e);
  };

  return (
    <TextField
      {...props}
      onChange={handleInternalChange}
      error={internalError || props.error}
      helperText={internalError ? errorText : props.helperText}
    />
  );
}
