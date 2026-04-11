import { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask, getListTasksQueryKey, Task, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Plus, Trash2, Edit2, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Tasks() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { data: tasks } = useListTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = tasks?.filter(t => filterStatus === "all" || t.status === filterStatus);

  const [formData, setFormData] = useState({ title: "", description: "", priority: "medium" as any, status: "pending" as any });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createTask.mutate({ data: { title: formData.title, description: formData.description, priority: formData.priority } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsCreateOpen(false);
        setFormData({ title: "", description: "", priority: "medium", status: "pending" });
      }
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    updateTask.mutate({ id: editingTask.id, data: { title: formData.title, description: formData.description, priority: formData.priority, status: formData.status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsEditOpen(false);
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Confirm deletion of task ID-" + id)) {
      deleteTask.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        }
      });
    }
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
    <div className="flex-1 p-6 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-bold text-primary tracking-widest uppercase">Task Matrix</h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Active Operations Queue</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px] bg-black border-primary/30 text-primary font-mono rounded-sm">
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
              <Button className="bg-primary/10 text-primary border border-primary/50 hover:bg-primary hover:text-black font-mono uppercase rounded-sm">
                <Plus className="w-4 h-4 mr-2" /> New Task
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
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono text-primary uppercase">Priority</label>
                  <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v as any})}>
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
                <Button type="submit" disabled={createTask.isPending} className="w-full bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-black font-mono uppercase mt-4">
                  Deploy Task
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-3">
        <AnimatePresence>
          {filteredTasks?.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-4 border rounded-sm flex items-start gap-4 transition-colors ${
                task.status === 'completed' ? 'bg-primary/5 border-primary/20' :
                task.status === 'failed' ? 'bg-destructive/5 border-destructive/20' :
                task.status === 'in_progress' ? 'bg-secondary/5 border-secondary/20' :
                'bg-black border-sidebar-border hover:border-primary/30'
              }`}
            >
              <div className="mt-1">
                {getStatusIcon(task.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">ID-{task.id}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                      task.priority === 'critical' ? 'text-destructive border-destructive/30' :
                      task.priority === 'high' ? 'text-secondary border-secondary/30' :
                      'text-muted-foreground border-muted-border'
                    }`}>
                      PRIORITY_{task.priority}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    {format(new Date(task.updatedAt), 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
                <h3 className="text-base font-mono text-foreground font-semibold mb-1 truncate">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(task)} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-sm">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
          {filteredTasks?.length === 0 && (
            <div className="h-40 flex items-center justify-center border border-dashed border-primary/20 rounded-sm">
              <span className="font-mono text-muted-foreground uppercase tracking-widest">No tasks found matching parameters</span>
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
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-primary/5 border-primary/30 text-primary font-mono rounded-sm min-h-[100px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-primary uppercase">Priority</label>
                <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v as any})}>
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
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as any})}>
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
            <Button type="submit" disabled={updateTask.isPending} className="w-full bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-black font-mono uppercase mt-4">
              Apply Configuration
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}