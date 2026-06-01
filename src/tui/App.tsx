import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { ConfigMissingError, readConfig, type ConfigOverrides, type Pan123CliConfig } from '../config.js';
import { SetupWizard } from './SetupWizard.js';
import { FileBrowser } from './FileBrowser.js';
import { Panel, Shell, SpinnerText } from './ui.js';

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
    return (
      <Shell subtitle="正在启动">
        <Panel title="加载中" minHeight={5}>
          <SpinnerText label="正在读取 ~/.123pancli/config.json" />
        </Panel>
      </Shell>
    );
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
      <Shell subtitle="启动失败">
        <Panel title="✕ 启动错误" color="red">
          <Text>{error}</Text>
        </Panel>
      </Shell>
    );
  }

  return config ? <FileBrowser config={config} /> : <Text color="red">Missing config.</Text>;
}
