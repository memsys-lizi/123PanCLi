import React, { type ReactNode, useEffect, useState } from 'react';
import { Box, Text } from 'ink';

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function SpinnerText({ label }: { label: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame(value => (value + 1) % spinnerFrames.length), 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color="cyan">
      {spinnerFrames[frame]} {label}
    </Text>
  );
}

export function Shell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          ◆ pan123
        </Text>
        <Text color="gray">{subtitle ?? '123云盘终端工作台'}</Text>
      </Box>
      {children}
    </Box>
  );
}

export function Panel({
  title,
  children,
  width,
  minHeight,
  color = 'cyan'
}: {
  title: string;
  children: ReactNode;
  width?: number | string;
  minHeight?: number;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'magenta' | 'blue' | 'gray';
}) {
  return (
    <Box borderStyle="round" borderColor={color} flexDirection="column" paddingX={1} paddingY={0} width={width} minHeight={minHeight}>
      <Text bold color={color}>
        {title}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  );
}

export function CommandBar({ items }: { items: Array<[string, string]> }) {
  const midpoint = Math.ceil(items.length / 2);
  const rows = [items.slice(0, midpoint), items.slice(midpoint)];
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1} flexDirection="column">
      {rows.map((row, rowIndex) => (
        <Text key={rowIndex}>
          {row.map(([key, label], index) => (
            <Text key={key}>
              {index > 0 ? <Text color="gray">  |  </Text> : null}
              <Text color="cyan">{key}</Text>
              <Text color="gray"> {label}</Text>
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}

export function StatusLine({
  busy,
  error,
  message
}: {
  busy?: boolean;
  error?: string;
  message: string;
}) {
  if (error) {
    return (
      <Box marginTop={1}>
        <Text color="red">✕ {error}</Text>
      </Box>
    );
  }

  return (
    <Box marginTop={1}>
      {busy ? <SpinnerText label={message} /> : <Text color="green">✓ {message}</Text>}
    </Box>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Text color="gray">◇ {title}</Text>
      <Text color="gray">{hint}</Text>
    </Box>
  );
}
