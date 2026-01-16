import { useState } from 'react';
import { BoardTaskItem } from '../types';

export function useTaskFilters() {
  const [priorityFilter, setPriorityFilter] = useState<'all' | BoardTaskItem['priority']>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | string>('all');

  const resetFilters = () => {
    setPriorityFilter('all');
    setAssigneeFilter('all');
  };

  const filterTasks = (tasks: BoardTaskItem[]): BoardTaskItem[] => {
    return tasks.filter((task) => {
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter === 'all' ||
        (assigneeFilter === 'Sin asignar' && task.owner === 'Sin asignar') ||
        task.owner === assigneeFilter;
      return matchesPriority && matchesAssignee;
    });
  };

  const isFiltering = priorityFilter !== 'all' || assigneeFilter !== 'all';

  return {
    priorityFilter,
    assigneeFilter,
    setPriorityFilter,
    setAssigneeFilter,
    resetFilters,
    filterTasks,
    isFiltering,
  };
}