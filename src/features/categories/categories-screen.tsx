import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getArchiveCategoryError,
  validateCategoryName,
} from '@/lib/category-utils';
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { useCategoriesStore } from '@/store/categories-store';
import { OTHER_CATEGORY_ID, type Category } from '@/types/category';

export function CategoriesScreen() {
  const categories = useCategoriesStore((state) => state.categories);

  const activeCategories = useCategoriesStore(
    (state) => state.activeCategories,
  );

  const isLoading = useCategoriesStore((state) => state.isLoading);
  const isInitialized = useCategoriesStore((state) => state.isInitialized);
  const error = useCategoriesStore((state) => state.error);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const addCategory = useCategoriesStore((state) => state.addCategory);
  const updateCategory = useCategoriesStore((state) => state.updateCategory);
  const archiveCategory = useCategoriesStore((state) => state.archiveCategory);
  const clearError = useCategoriesStore((state) => state.clearError);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );

  const [editingName, setEditingName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  useCategoriesRefresh({
    isInitialized,
    loadCategories,
    loadOnMount: 'always',
  });

  function handleStartEdit(category: Category) {
    clearError();
    setAddError(null);
    setArchiveError(null);
    setEditingCategoryId(category.id);
    setEditingName(category.name);
    setEditError(null);
  }

  async function handleAddCategory() {
    if (isLoading) return;

    clearError();
    setArchiveError(null);
    setEditError(null);

    const validationError = validateCategoryName({
      name: newCategoryName,
      categories,
    });

    setAddError(validationError);

    if (validationError) return;

    await addCategory(newCategoryName);

    if (!useCategoriesStore.getState().error) {
      setNewCategoryName('');
      setAddError(null);
    }
  }

  async function handleSaveEdit() {
    if (!editingCategoryId || isLoading) return;

    clearError();
    setAddError(null);
    setArchiveError(null);

    const validationError = validateCategoryName({
      name: editingName,
      categories,
      currentCategoryId: editingCategoryId,
    });

    setEditError(validationError);

    if (validationError) return;

    await updateCategory(editingCategoryId, { name: editingName });

    if (!useCategoriesStore.getState().error) {
      setEditingCategoryId(null);
      setEditingName('');
      setEditError(null);
    }
  }

  function handleArchiveCategory(category: Category) {
    if (isLoading) return;

    clearError();
    setAddError(null);
    setEditError(null);

    const validationError = getArchiveCategoryError({
      category,
      categories,
    });

    setArchiveError(validationError);

    if (validationError) return;

    Alert.alert(
      'Delete category?',
      'This hides the category from new transactions. Old transactions will still show it.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void archiveCategory(category.id);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Manage Categories</Text>

          <Text style={styles.subtitle}>
            Add, rename, or hide the buckets you use to notice spending leaks.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Add category</Text>

          <TextInput
            value={newCategoryName}
            onChangeText={(value) => {
              setNewCategoryName(value);
              setAddError(null);
            }}
            placeholder="Coffee"
            autoCapitalize="words"
            autoCorrect={false}
            style={[styles.input, addError ? styles.inputError : null]}
          />

          {addError ? <Text style={styles.errorText}>{addError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => {
              void handleAddCategory();
            }}
            style={[
              styles.primaryButton,
              isLoading ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Saving...' : 'Add Category'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Active categories</Text>

          {!isInitialized ? (
            <Text style={styles.metaText}>Loading categories...</Text>
          ) : null}

          {activeCategories.map((category) => {
            const isEditing = editingCategoryId === category.id;
            const isOtherCategory = category.id === OTHER_CATEGORY_ID;

            return (
              <View key={category.id} style={styles.categoryRow}>
                {isEditing ? (
                  <>
                    <TextInput
                      value={editingName}
                      onChangeText={(value) => {
                        setEditingName(value);
                        setEditError(null);
                      }}
                      autoCapitalize="words"
                      autoCorrect={false}
                      style={[
                        styles.input,
                        editError ? styles.inputError : null,
                      ]}
                    />

                    {editError ? (
                      <Text style={styles.errorText}>{editError}</Text>
                    ) : null}

                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isLoading}
                        onPress={() => {
                          void handleSaveEdit();
                        }}
                        style={[
                          styles.smallPrimaryButton,
                          isLoading ? styles.buttonDisabled : null,
                        ]}
                      >
                        <Text style={styles.smallPrimaryButtonText}>Save</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        disabled={isLoading}
                        onPress={() => {
                          setEditingCategoryId(null);
                          setEditingName('');
                          setEditError(null);
                        }}
                        style={styles.smallSecondaryButton}
                      >
                        <Text style={styles.smallSecondaryButtonText}>
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryName}>{category.name}</Text>

                      {isOtherCategory ? (
                        <Text style={styles.metaText}>Required fallback</Text>
                      ) : null}
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isLoading}
                        onPress={() => handleStartEdit(category)}
                        style={styles.smallSecondaryButton}
                      >
                        <Text style={styles.smallSecondaryButtonText}>
                          Edit
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        disabled={isLoading || isOtherCategory}
                        onPress={() => handleArchiveCategory(category)}
                        style={[
                          styles.smallDangerButton,
                          isOtherCategory ? styles.buttonDisabled : null,
                        ]}
                      >
                        <Text style={styles.smallDangerButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          })}

          {archiveError ? (
            <Text style={styles.errorText}>{archiveError}</Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f5',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
  },
  sectionCard: {
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#111827',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  categoryRow: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 14,
  },
  categoryCopy: {
    gap: 4,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallPrimaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingVertical: 12,
  },
  smallPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  smallSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
  },
  smallSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  smallDangerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
    paddingVertical: 12,
  },
  smallDangerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c',
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
});
