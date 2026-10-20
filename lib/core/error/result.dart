// lib/core/error/result.dart
//
// Type Result<T> : toute opération faillible de Yako renvoie soit un
// Success<T>, soit un FailureResult<T> portant une Failure. Aucune exception
// ne doit traverser une frontière de couche (data → domain → presentation).

import 'package:yako/core/error/failure.dart';

/// Outcome of an operation that can fail.
sealed class Result<T> {
  const Result();

  /// Wraps [value] in a [Success].
  const factory Result.success(T value) = Success<T>;

  /// Wraps [failure] in a [FailureResult].
  const factory Result.failure(Failure failure) = FailureResult<T>;

  /// Whether this result holds a value.
  bool get isSuccess => this is Success<T>;

  /// Whether this result holds a failure.
  bool get isFailure => this is FailureResult<T>;

  /// Returns the value, or `null` on failure.
  T? getOrNull() => switch (this) {
    Success<T>(:final value) => value,
    FailureResult<T>() => null,
  };

  /// Returns the failure, or `null` on success.
  Failure? getFailureOrNull() => switch (this) {
    Success<T>() => null,
    FailureResult<T>(:final failure) => failure,
  };

  /// Collapses both branches into a single value.
  R fold<R>(
    R Function(T value) onSuccess,
    R Function(Failure failure) onFailure,
  ) => switch (this) {
    Success<T>(:final value) => onSuccess(value),
    FailureResult<T>(:final failure) => onFailure(failure),
  };

  /// Transforms the value, keeping a failure untouched.
  Result<R> map<R>(R Function(T value) transform) => switch (this) {
    Success<T>(:final value) => Success<R>(transform(value)),
    FailureResult<T>(:final failure) => FailureResult<R>(failure),
  };

  /// Chains another fallible operation on success.
  Result<R> flatMap<R>(Result<R> Function(T value) transform) => switch (this) {
    Success<T>(:final value) => transform(value),
    FailureResult<T>(:final failure) => FailureResult<R>(failure),
  };
}

/// Successful result.
final class Success<T> extends Result<T> {
  const Success(this.value);

  /// The produced value.
  final T value;

  @override
  String toString() => 'Success';
}

/// Failed result.
final class FailureResult<T> extends Result<T> {
  const FailureResult(this.failure);

  /// The failure describing what went wrong.
  final Failure failure;

  @override
  String toString() => 'FailureResult($failure)';
}
