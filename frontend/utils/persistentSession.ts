import { AppState, type AppStateStatus } from 'react-native';
import { bootstrapSession } from '@/utils/api';

/**
 * Keeps long-lived sessions alive across app restarts and foreground returns.
 * Never clears auth — only explicit Logout does that.
 */
export function startPersistentSessionMaintenance(): () => void {
  void bootstrapSession();

  const onChange = (state: AppStateStatus) => {
    if (state === 'active') {
      void bootstrapSession();
    }
  };

  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
