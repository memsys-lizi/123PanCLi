import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { createClient } from '../client.js';
import { createConfig, writeConfig, type Pan123CliConfig } from '../config.js';
import { CommandBar, Panel, Shell, SpinnerText, StatusLine } from './ui.js';

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
      setError('这个字段必填。');
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
    <Shell subtitle="首次配置 123 云盘凭证">
      <Box flexDirection="row">
        <Panel title="◆ 配置步骤" width={30} color="magenta">
          <Text color={field === 'clientId' ? 'cyan' : 'green'}>{field === 'clientId' ? '●' : '✓'} 1. Client ID</Text>
          <Text color={field === 'clientSecret' ? 'cyan' : clientSecret ? 'green' : 'gray'}>
            {field === 'clientSecret' ? '●' : clientSecret ? '✓' : '○'} 2. Client Secret
          </Text>
          <Text color="gray">○ 3. 校验 API 权限</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">配置文件</Text>
            <Text>~/.123pancli/config.json</Text>
          </Box>
        </Panel>
        <Box marginLeft={1} flexGrow={1}>
          <Panel title={field === 'clientId' ? '输入 PAN123_CLIENT_ID' : '输入 PAN123_CLIENT_SECRET'} color="cyan">
            <Text color="gray">
              pan123 会先校验凭证，成功后写入本地 config.json。
            </Text>
            <Box marginTop={1}>
              <Text color="cyan">{field === 'clientId' ? 'ID     ' : 'SECRET '} </Text>
              {busy ? (
                <SpinnerText label="正在校验凭证" />
              ) : (
                <TextInput
                  value={field === 'clientId' ? clientId : clientSecret}
                  onChange={field === 'clientId' ? setClientId : setClientSecret}
                  onSubmit={submitCurrent}
                  mask={field === 'clientSecret' ? '*' : undefined}
                />
              )}
            </Box>
            <StatusLine busy={busy} error={error} message={field === 'clientId' ? '等待输入 client id' : '等待输入 client secret'} />
          </Panel>
        </Box>
      </Box>
      <CommandBar items={[['enter', '下一步'], ['ctrl+c', '退出']]} />
    </Shell>
  );
}
