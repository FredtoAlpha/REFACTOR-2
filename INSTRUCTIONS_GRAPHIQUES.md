# 📊 AJOUT DU PANNEAU DE STATISTIQUES COMPARATIVES

## Ce qu'on va ajouter :

### 1. Agrandissement de la modale
- **Avant** : `max-w-[95vw] max-h-[95vh]`
- **Après** : `w-[98vw] h-[98vh]`

### 2. Layout à l'étape 5 (Groupes générés)

```
┌─────────────────────────────────────────────────────────┐
│                        HEADER                            │
├───────────────────────────┬─────────────────────────────┤
│                           │                             │
│  GROUPES (Grille 3x2)    │   STATISTIQUES COMPARATIVES │
│  - Groupe 1               │   - Graphique Radar        │
│  - Groupe 2               │     (COM, TRA, PART, ABS)  │
│  - Groupe 3               │   - Graphique Barres F/M   │
│  - Groupe 4               │   - Indicateurs d'équilibre│
│                           │   - Alertes visuelles       │
│  (70% largeur)            │   (30% largeur)            │
│                           │                             │
└───────────────────────────┴─────────────────────────────┘
```

### 3. Graphiques avec Chart.js

**CDN à ajouter** :
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
```

**Graphique 1 : Radar des critères**
- Compare COM, TRA, PART, ABS entre tous les groupes
- Chaque groupe = une ligne de couleur différente
- Permet de voir si les groupes sont équilibrés

**Graphique 2 : Barres F/M**
- Barres empilées pour chaque groupe
- Rose = Filles, Bleu = Garçons
- Ligne pointillée = parité parfaite 50/50

**Indicateurs d'équilibre** :
- ✅ Vert : Différence ≤ 1 élève entre groupes
- ⚠️ Orange : Différence de 2-3 élèves
- ❌ Rouge : Différence > 3 élèves

**Pour les groupes Besoins** :
- Graphique supplémentaire : Distribution des scores moyens
- Vérification hétérogénéité (tous les groupes doivent avoir des moyennes proches)

### 4. Mise à jour en temps réel

Après chaque drag & drop :
```javascript
function moveStudent(studentId, fromGroup, toGroup) {
  // ... déplacer l'élève ...

  // Mettre à jour stats
  updateGroupStats(fromGroupIndex);
  updateGroupStats(toGroupIndex);

  // NOUVEAU : Mettre à jour graphiques
  updateCharts();
}
```

## Modifications à faire :

### Fichier : groupsModuleComplete.html

#### 1. Ligne 178 - Agrandir la modale
```javascript
// AVANT
panel.className = 'bg-white rounded-3xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col';

// APRÈS
panel.className = 'bg-white rounded-3xl shadow-2xl w-[98vw] h-[98vh] overflow-hidden flex flex-col';
```

#### 2. Dans state (ligne 76) - Ajouter charts
```javascript
const state = {
  // ... existant ...

  // NOUVEAU
  charts: {
    radar: null,
    genderBars: null
  }
};
```

#### 3. Fonction renderStep5_Groups - Modifier le layout

```javascript
// Remplacer le return de renderStep5_Groups par :
return `
  <div class="flex gap-6 h-full">
    <!-- GAUCHE : GROUPES (70%) -->
    <div class="flex-1 flex flex-col">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-xl font-bold text-slate-900">Groupes générés</h3>
          <p class="text-sm text-slate-600">${state.generatedGroups.length} groupe(s) • ${getTotalStudents()} élèves</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="action-btn bg-slate-100 hover:bg-slate-200 text-slate-700" data-action="regenerate">
            <i class="fas fa-rotate-right"></i> Régénérer
          </button>
          <button type="button" class="action-btn bg-green-100 hover:bg-green-200 text-green-700" data-action="export-csv">
            <i class="fas fa-file-csv"></i> CSV
          </button>
          <button type="button" class="action-btn bg-purple-600 hover:bg-purple-700 text-white" data-action="save-groups">
            <i class="fas fa-save"></i> Sauvegarder
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div class="grid grid-cols-3 gap-4" id="groups-container">
          ${state.generatedGroups.map((group, index) => renderGroupCard(group, index)).join('')}
        </div>
      </div>
    </div>

    <!-- DROITE : STATISTIQUES (30%) -->
    <div class="w-[30%] flex flex-col gap-4 overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border-2 border-slate-200">
      <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
        <i class="fas fa-chart-line text-indigo-600"></i>
        Statistiques Comparatives
      </h3>

      <!-- Indicateurs d'équilibre -->
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <h4 class="text-sm font-semibold text-slate-700 mb-3">Équilibre général</h4>
        <div id="balance-indicators"></div>
      </div>

      <!-- Graphique Radar : Critères -->
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <h4 class="text-sm font-semibold text-slate-700 mb-3">Critères pédagogiques</h4>
        <canvas id="radar-chart" height="200"></canvas>
      </div>

      <!-- Graphique Barres : Parité F/M -->
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <h4 class="text-sm font-semibold text-slate-700 mb-3">Répartition Filles/Garçons</h4>
        <canvas id="gender-chart" height="180"></canvas>
      </div>

      <!-- Alertes -->
      <div id="alerts-container" class="space-y-2"></div>
    </div>
  </div>
`;
```

#### 4. Ajouter les fonctions de graphiques

```javascript
// Après la fonction getTotalStudents(), ajouter :

// ═══════════════════════════════════════════════════════════════
//  STATISTIQUES & GRAPHIQUES
// ═══════════════════════════════════════════════════════════════

function updateCharts() {
  if (state.currentStep !== 5 || !state.generatedGroups.length) return;

  updateBalanceIndicators();
  updateRadarChart();
  updateGenderChart();
  updateAlerts();
}

function updateBalanceIndicators() {
  const container = qs('#balance-indicators', state.modal);
  if (!container) return;

  const effectifs = state.generatedGroups.map(g => g.students.length);
  const min = Math.min(...effectifs);
  const max = Math.max(...effectifs);
  const ecart = max - min;

  const pariteScores = state.generatedGroups.map(g => {
    const stats = calculateGroupStats(g);
    const total = stats.girls + stats.boys;
    return total > 0 ? Math.abs(stats.girls - stats.boys) / total : 0;
  });
  const avgParite = pariteScores.reduce((a, b) => a + b, 0) / pariteScores.length;

  container.innerHTML = `
    <div class="flex items-center justify-between py-2">
      <span class="text-sm text-slate-600">Écart d'effectifs</span>
      <span class="font-semibold ${ecart <= 1 ? 'text-green-600' : ecart <= 3 ? 'text-orange-600' : 'text-red-600'}">
        ${ecart === 0 ? '✅ Parfait' : ecart <= 1 ? `✅ ${ecart}` : ecart <= 3 ? `⚠️ ${ecart}` : `❌ ${ecart}`}
      </span>
    </div>
    <div class="flex items-center justify-between py-2 border-t border-slate-200">
      <span class="text-sm text-slate-600">Parité moyenne</span>
      <span class="font-semibold ${avgParite < 0.2 ? 'text-green-600' : avgParite < 0.4 ? 'text-orange-600' : 'text-red-600'}">
        ${avgParite < 0.2 ? '✅' : avgParite < 0.4 ? '⚠️' : '❌'} ${(avgParite * 100).toFixed(0)}%
      </span>
    </div>
  `;
}

function updateRadarChart() {
  const canvas = qs('#radar-chart', state.modal);
  if (!canvas) return;

  // Détruire ancien graphique
  if (state.charts.radar) {
    state.charts.radar.destroy();
  }

  const ctx = canvas.getContext('2d');
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

  const datasets = state.generatedGroups.map((group, index) => {
    const stats = calculateGroupStats(group);
    let totalCom = 0, totalTra = 0, totalPart = 0, totalAbs = 0;

    group.students.forEach(s => {
      totalCom += s.com || 0;
      totalTra += s.tra || 0;
      totalPart += s.part || 0;
      totalAbs += s.abs || 0;
    });

    const count = group.students.length || 1;

    return {
      label: group.name,
      data: [
        (totalCom / count).toFixed(1),
        (totalTra / count).toFixed(1),
        (totalPart / count).toFixed(1),
        (totalAbs / count).toFixed(1)
      ],
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
      borderWidth: 2
    };
  });

  state.charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['COM', 'TRA', 'PART', 'ABS'],
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 4
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 10 } }
        }
      }
    }
  });
}

function updateGenderChart() {
  const canvas = qs('#gender-chart', state.modal);
  if (!canvas) return;

  if (state.charts.genderBars) {
    state.charts.genderBars.destroy();
  }

  const ctx = canvas.getContext('2d');

  const labels = state.generatedGroups.map(g => g.name);
  const girlsData = state.generatedGroups.map(g => {
    const stats = calculateGroupStats(g);
    return stats.girls;
  });
  const boysData = state.generatedGroups.map(g => {
    const stats = calculateGroupStats(g);
    return stats.boys;
  });

  state.charts.genderBars = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Filles',
          data: girlsData,
          backgroundColor: '#ec4899',
        },
        {
          label: 'Garçons',
          data: boysData,
          backgroundColor: '#3b82f6',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 10 } }
        }
      }
    }
  });
}

function updateAlerts() {
  const container = qs('#alerts-container', state.modal);
  if (!container) return;

  const alerts = [];

  // Vérifier écarts d'effectifs
  const effectifs = state.generatedGroups.map(g => g.students.length);
  const max = Math.max(...effectifs);
  const min = Math.min(...effectifs);
  if (max - min > 3) {
    alerts.push({
      type: 'error',
      message: `Écart d'effectifs important : ${max - min} élèves`
    });
  }

  // Vérifier parité
  state.generatedGroups.forEach(g => {
    const stats = calculateGroupStats(g);
    const diff = Math.abs(stats.girls - stats.boys);
    if (diff > 3) {
      alerts.push({
        type: 'warning',
        message: `${g.name} : déséquilibre F/M (${stats.girls}F/${stats.boys}M)`
      });
    }
  });

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
        <i class="fas fa-check-circle text-green-600 mr-2"></i>
        Tous les groupes sont équilibrés !
      </div>
    `;
  } else {
    container.innerHTML = alerts.map(alert => `
      <div class="bg-${alert.type === 'error' ? 'red' : 'orange'}-50 border border-${alert.type === 'error' ? 'red' : 'orange'}-200 rounded-xl p-3 text-sm text-${alert.type === 'error' ? 'red' : 'orange'}-800">
        <i class="fas fa-${alert.type === 'error' ? 'exclamation-circle' : 'triangle-exclamation'} mr-2"></i>
        ${alert.message}
      </div>
    `).join('');
  }
}
```

#### 5. Appeler updateCharts après génération et drag&drop

```javascript
// Dans moveStudent(), ajouter à la fin :
updateCharts();

// Dans generateGroups(), après updateUI(), ajouter :
updateCharts();
```

#### 6. Charger Chart.js - Ajouter au début du HTML

```html
<!-- Au début du fichier, après les commentaires -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
```

## ✅ Résultat attendu

Après ces modifications :
- Fenêtre quasiment plein écran
- Groupes affichés en grille 3x2 à gauche
- Panneau stats à droite avec graphiques temps réel
- Aide visuelle pour équilibrer les groupes avec drag & drop
