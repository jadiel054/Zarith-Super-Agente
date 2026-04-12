import { useState, useRef } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask, getListTasksQueryKey, Task, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Plus, Trash2, Edit2, AlertCircle, Clock, CheckCircle2, XCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Tasks() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<number>>(new Set());
  const completedTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "delete" | "status";
  } | null>(null);

  const { data: tasks } = useListTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = tasks?.filter(t => filterStatus === "all" || t.status === filterStatus);

  const [formData, setFormData] = useState({ title: "", description: "", priority: "medium" as Task["priority"], status: "pending" as Task["status"] });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const flashCompleted = (id: number) => {
    setJustCompletedIds((prev) => new Set(prev).add(id));
    const existing = completedTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setJustCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      completedTimers.current.delete(id);
    }, 2500);
    completedTimers.current.set(id, t);
  };

  const requestConfirm = (action: typeof confirmAction) => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    requestConfirm({
      title: "Deploy New Task",
      description: `Confirm creation of task: "${formData.title}" with ${formData.priority} priority.`,
      variant: "status",
      onConfirm: () => {
        createTask.mutate(
          { data: { title: formData.title, description: formData.description, priority: formData.priority } },
          {
            onSuccess: () => {
              invalidateAll();
              setIsCreateOpen(false);
              setFormData({ title: "", description: "", priority: "medium", status: "pending" });
            },
          }
        );
      },
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    const statusChanged = editingTask.status !== formData.status;
    const becomingCompleted = statusChanged && formData.status === "completed";
    const description = statusChanged
      ? `Change status of "${editingTask.title}" to ${formData.status.replace("_", " ").toUpperCase()}?`
      : `Apply configuration changes to "${editingTask.title}"?`;

    requestConfirm({
      title: "Apply Configuration",
      description,
      variant: "status",
      onConfirm: () => {
        updateTask.mutate(
          { id: editingTask.id, data: { title: formData.title, description: formData.description, priority: formData.priority, status: formData.status } },
          {
            onSuccess: () => {
              invalidateAll();
              setIsEditOpen(false);
              if (becomingCompleted) flashCompleted(editingTask.id);
            },
          }
        );
      },
    });
  };

  const handleDelete = (task: Task) => {
    requestConfirm({
      title: "Terminate Task",
      description: `This will permanently delete task "${task.title}" (ID-${task.id}). This action cannot be undone.`,
      variant: "delete",
      onConfirm: () => {
        deleteTask.mutate({ id: task.id }, { onSuccess: invalidateAll });
      },
    });
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({ title: task.title, description: task.description || "", priority: task.priority, status: task.status });
    setIsEditOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'in_progress': return <AlertCircle className="w-4 h-4 text-secondary" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-primary" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-mono font-bold text-primary tracking-widest uppercase">Task Matrix</h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Active Operations Queue</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] sm:w-[180px] bg-black border-primary/30 text-primary font-mono rounded-sm text-xs">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent className="bg-black border-primary/30 font-mono">
              <SelectItem value="all">ALL_TASKS</SelectItem>
              <SelectItem value="pending">PENDING</SelectItem>
              <SelectItem value="in_progress">IN_PROGRESS</SelectItem>
              <SelectItem value="completed">COMPLETED</SelectItem>
              <SelectItem value="failed">FAILED</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="button-create-task"
                className="bg-primary/10 text-primary border border-primary/50 hover:bg-primary hover:text-black font-mono uppercase rounded-sm text-xs"
              >
                <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">New Task</span>
                <span className="sm:hidden">New</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border border-primary/30 rounded-sm sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="font-mono text-primary uppercase tracking-widest">Initialize New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-primary uppercase">Title</label>
                  <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono text-primary uppercase">Description</label>
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm min-h-[80px]" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono text-primary uppercase">Priority</label>
                  <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v as Task["priority"]})}>
                    <SelectTrigger className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-primary/30 font-mono text-primary">
                      <SelectItem value="low">LOW</SelectItem>
                      <SelectItem value="medium">MEDIUM</SelectItem>
                      <SelectItem value="high">HIGH</SelectItem>
                      <SelectItem value="critical">CRITICAL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={createTask.isPending} className="w-full bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-black font-mono uppercase mt-2">
                  Deploy Task
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 pb-6 space-y-3">
        <AnimatePresence>
          {filteredTasks?.map((task) => {
            const isFlashing = justCompletedIds.has(task.id);
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  boxShadow: isFlashing
                    ? [
                        "0 0 0px rgba(0,255,255,0)",
                        "0 0 24px rgba(0,255,255,0.7)",
                        "0 0 12px rgba(0,255,255,0.4)",
                        "0 0 0px rgba(0,255,255,0)",
                      ]
                    : "0 0 0px rgba(0,255,255,0)",
                }}
                transition={{ duration: isFlashing ? 2 : 0.3, ease: "easeOut" }}
                exit={{ opacity: 0, scale: 0.95 }}
                data-testid={`card-task-${task.id}`}
                className={`p-4 border rounded-sm flex items-start gap-3 sm:gap-4 transition-colors ${
                  task.status === 'completed' ? 'bg-primary/5 border-primary/20' :
                  task.status === 'failed' ? 'bg-destructive/5 border-destructive/20' :
                  task.status === 'in_progress' ? 'bg-secondary/5 border-secondary/20' :
                  'bg-black border-sidebar-border hover:border-primary/30'
                }`}
              >
                <div className="mt-1 shrink-0">{getStatusIcon(task.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">ID-{task.id}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                      task.priority === 'critical' ? 'text-destructive border-destructive/30' :
                      task.priority === 'high' ? 'text-secondary border-secondary/30' :
                      'text-muted-foreground border-muted-border'
                    }`}>
                      {task.priority}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                      {format(new Date(task.updatedAt), 'MM-dd HH:mm')}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-mono text-foreground font-semibold mb-1 truncate">{task.title}</h3>
                  {task.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(task)}
                    data-testid={`button-edit-task-${task.id}`}
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(task)}
                    data-testid={`button-delete-task-${task.id}`}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
          {filteredTasks?.length === 0 && (
            <div className="h-40 flex items-center justify-center border border-dashed border-primary/20 rounded-sm">
              <span className="font-mono text-muted-foreground uppercase tracking-widest text-xs text-center px-4">No tasks found matching parameters</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-black border border-primary/30 rounded-sm sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary uppercase tracking-widest">Reconfigure Task ID-{editingTask?.id}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-mono text-primary uppercase">Title</label>
              <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono text-primary uppercase">Description</label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-primary uppercase">Priority</label>
                <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v as Task["priority"]})}>
                  <SelectTrigger className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-primary/30 font-mono text-primary">
                    <SelectItem value="low">LOW</SelectItem>
                    <SelectItem value="medium">MEDIUM</SelectItem>
                    <SelectItem value="high">HIGH</SelectItem>
                    <SelectItem value="critical">CRITICAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-primary uppercase">Status</label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as Task["status"]})}>
                  <SelectTrigger className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-primary/30 font-mono text-primary">
                    <SelectItem value="pending">PENDING</SelectItem>
                    <SelectItem value="in_progress">IN_PROGRESS</SelectItem>
                    <SelectItem value="completed">COMPLETED</SelectItem>
                    <SelectItem value="failed">FAILED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={updateTask.isPending} className="w-full bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-black font-mono uppercase mt-2">
              Apply Configuration
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-black border border-primary/30 rounded-sm font-mono max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary uppercase tracking-widest flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" />
              {confirmAction?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-mono text-sm">
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              data-testid="button-confirm-cancel"
              className="bg-transparent border border-primary/30 text-muted-foreground hover:text-primary hover:bg-primary/10 font-mono uppercase text-xs rounded-sm"
            >
              Abort
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-proceed"
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmOpen(false);
              }}
              className={`font-mono uppercase text-xs rounded-sm border ${
                confirmAction?.variant === "delete"
                  ? "bg-destructive/20 text-destructive border-destructive/50 hover:bg-destructive hover:text-white"
                  : "bg-primary/20 text-primary border-primary/50 hover:bg-primary hover:text-black"
              }`}
            >
              Confirm Execute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
