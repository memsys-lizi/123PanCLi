import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { ConfigMissingError, readConfig, type ConfigOverrides, type Pan123CliConfig } from '../config.js';
import { SetupWizard } from './SetupWizard.js';
import { FileBrowser } from './FileBrowser.js';

export interface AppProps {
  forceSetup?: boolean;
  overrides?: ConfigOverrides;
}

export function App({ forceSetup = false, overrides = {} }: AppProps) {
  const [status, setStatus] = useState<'loading' | 'setup' | 'ready' | 'error'>(forceSetup ? 'setup' : 'loading');
  const [config, setConfig] = useState<Pan123CliConfig | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (forceSetup) return;
    readConfig(overrides)
      .then(value => {
        setConfig(value);
        setStatus('ready');
      })
      .catch(caught => {
        if (caught instanceof ConfigMissingError) {
          setStatus('setup');
          return;
        }
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus('error');
      });
  }, [forceSetup, overrides.clientId, overrides.clientSecret, overrides.baseURL]);

  if (status === 'loading') {
    return <Text color="cyan">Loading pan123...</Text>;
  }

  if (status === 'setup') {
    return (
      <SetupWizard
        onConfigured={nextConfig => {
          setConfig(nextConfig);
          setStatus('ready');
        }}
      />
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to start pan123</Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  return config ? <FileBrowser config={config} /> : <Text color="red">Missing config.</Text>;
}
