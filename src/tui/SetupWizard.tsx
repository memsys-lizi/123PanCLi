import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { createClient } from '../client.js';
import { createConfig, writeConfig, type Pan123CliConfig } from '../config.js';

interface SetupWizardProps {
  onConfigured: (config: Pan123CliConfig) => void;
}

type Field = 'clientId' | 'clientSecret';

export function SetupWizard({ onConfigured }: SetupWizardProps) {
  const [field, setField] = useState<Field>('clientId');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submitCurrent(value: string) {
    setError(undefined);
    if (!value.trim()) {
      setError('This field is required.');
      return;
    }
    if (field === 'clientId') {
      setClientId(value.trim());
      setField('clientSecret');
      return;
    }

    const nextSecret = value.trim();
    setClientSecret(nextSecret);
    setBusy(true);
    try {
      const config = createConfig({ clientId, clientSecret: nextSecret });
      await createClient(config).user.info();
      await writeConfig(config);
      onConfigured(config);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setField('clientId');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="cyan" bold>
        pan123 setup
      </Text>
      <Text color="gray">Config will be saved to ~/.123pancli/config.json after validation.</Text>
      <Box marginTop={1}>
        <Text>{field === 'clientId' ? 'PAN123_CLIENT_ID: ' : 'PAN123_CLIENT_SECRET: '}</Text>
        {busy ? (
          <Text color="yellow">validating...</Text>
        ) : (
          <TextInput
            value={field === 'clientId' ? clientId : clientSecret}
            onChange={field === 'clientId' ? setClientId : setClientSecret}
            onSubmit={submitCurrent}
            mask={field === 'clientSecret' ? '*' : undefined}
          />
        )}
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
      <Text color="gray">Press Ctrl+C to exit.</Text>
    </Box>
  );
}
