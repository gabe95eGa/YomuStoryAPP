import { useMemo } from 'react';
import { VocabularyPage } from './VocabularyPage';
import { createLearnerContextService, type LearnerContextService } from '../lib/learnerContext';
import type { BackupService } from '../lib/backup';
import type { VocabularyStateService } from '../lib/vocabulary';

export default function VocabularyRoute({ backup, contextService, vocabulary }: { backup: BackupService; contextService?: LearnerContextService; vocabulary: VocabularyStateService }) {
  const generationContext = useMemo(() => contextService ?? createLearnerContextService(vocabulary), [contextService, vocabulary]);
  return <VocabularyPage backup={backup} generationContext={generationContext} usesExampleProfile={!contextService} />;
}
