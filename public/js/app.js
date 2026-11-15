import { setUnauthorizedHandler } from './api.js';
import VIcon from './components/VIcon.js';
import AuthScreen from './components/AuthScreen.js';
import AdminDashboard from './components/AdminDashboard.js';
import TeacherDashboard from './components/TeacherDashboard.js';
import JudgeDashboard from './components/JudgeDashboard.js';
import AppModals from './components/AppModals.js';
import {
  currentUser, token, selectedPeriodId, loadAppConfig, loadPublicDepartments, loadPeriods,
  confirmModalState, resolveConfirmDialog, toastList, dismissToast
} from './composables/useAppState.js';
import { createAuthActions } from './composables/useAuth.js';
import { loadAdminDashboard, createAdminActions } from './composables/useAdmin.js';
import {
  loadTeacherEvaluationSheet, teacherScores, teacherComments, teacherEvidence,
  teacherJudgeEvaluations, teacherConsolidatedSummary, createTeacherActions
} from './composables/useTeacher.js';
import { judgeViewMode, judgeCandidates, loadJudgeCandidates, createJudgeActions } from './composables/useJudge.js';

const { createApp, onMounted } = window.Vue;

const app = createApp({
  components: { AuthScreen, AdminDashboard, TeacherDashboard, JudgeDashboard, AppModals },
  setup() {
    const resetSessionState = () => {
      teacherScores.value = {}; teacherComments.value = {}; teacherEvidence.value = {};
      teacherJudgeEvaluations.value = []; teacherConsolidatedSummary.value = null;
      judgeCandidates.value = []; judgeViewMode.value = 'list';
    };

    async function loadInitialData() {
      if (!currentUser.value) return;
      await loadPeriods();
      await loadPublicDepartments();
      const role = currentUser.value.role;
      if (role === 'admin' || role === 'hr') await loadAdminDashboard();
      else if (role === 'teacher') await loadTeacherEvaluationSheet(selectedPeriodId.value);
      else if (role === 'judge') await loadJudgeCandidates(selectedPeriodId.value);
    }

    const authActions = createAuthActions({
      onLoginSuccess: loadInitialData,
      onTeacherReload: () => loadTeacherEvaluationSheet(selectedPeriodId.value),
      onAdminReload: loadAdminDashboard,
      onResetSession: resetSessionState
    });
    const adminActions = createAdminActions(loadInitialData);
    const teacherActions = createTeacherActions();
    const judgeActions = createJudgeActions();

    setUnauthorizedHandler(() => authActions.logout());

    onMounted(async () => {
      await loadAppConfig();
      await loadPublicDepartments();
      const savedUser = localStorage.getItem('user');
      if (token.value && savedUser) {
        try {
          currentUser.value = JSON.parse(savedUser);
          await loadInitialData();
        } catch { authActions.logout(); }
      }
    });

    return {
      currentUser, authActions, adminActions, teacherActions, judgeActions,
      openProfileModal: authActions.openProfileModal, logout: authActions.logout,
      confirmModalState, resolveConfirmDialog, toastList, dismissToast
    };
  }
});

app.component('v-icon', VIcon);
app.mount('#app');
